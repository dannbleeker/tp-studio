import { exportToJSON, saveToLocalStorage } from '@/domain/persistence';
import type { TPDocument } from '@/domain/types';
import { STORAGE_KEYS, removeKey, writeString } from './storage';

// Idle window before we hit the committed doc key. A burst of mutations
// inside this window coalesces into one JSON.stringify + setItem call,
// which matters for large docs where serialization is non-trivial.
const DEBOUNCE_MS = 200;

// Session 107 — `requestIdleCallback` timeout (ms). Caps how long the
// canonical write can be deferred when the main thread is busy. If
// the browser hasn't gone idle within this window we run anyway so
// the debounced write still lands deterministically.
//
// Tradeoff: shorter timeout = sooner write (less crash-loss risk) but
// more interference with active interaction; longer timeout = stays
// out of the user's way but increases the worst-case unwritten
// window. 1.5 s lets typical drag/type sequences finish without
// stranding the doc for more than ~1 s of inactivity.
const IDLE_TIMEOUT_MS = 1500;

/**
 * Run `cb` during the next browser idle window (preferred), or after
 * a short timeout when `requestIdleCallback` isn't available
 * (older Safari, test env). Returns a cancel handle.
 *
 * Motivation: `JSON.stringify` on a large doc is ~30–50 ms at 200
 * entities and blocks the main thread. Scheduling the canonical
 * write via `requestIdleCallback` puts it in the gap *between*
 * input frames — invisible to the user. The Session 106 perf trace
 * showed long tasks taking ~122 ms each; this is one of the moves
 * that should shrink that tail.
 */
type IdleHandle =
  | { type: 'idle'; id: number }
  | { type: 'timer'; id: ReturnType<typeof setTimeout> };

const requestIdle = (cb: () => void): IdleHandle => {
  if (typeof window === 'undefined') {
    cb();
    return { type: 'timer', id: setTimeout(() => {}, 0) };
  }
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  };
  if (typeof w.requestIdleCallback === 'function') {
    const id = w.requestIdleCallback(cb, { timeout: IDLE_TIMEOUT_MS });
    return { type: 'idle', id };
  }
  const id = setTimeout(cb, 0);
  return { type: 'timer', id };
};

const cancelIdle = (handle: IdleHandle): void => {
  if (typeof window === 'undefined') return;
  if (handle.type === 'idle') {
    const w = window as Window & { cancelIdleCallback?: (id: number) => void };
    if (typeof w.cancelIdleCallback === 'function') {
      w.cancelIdleCallback(handle.id);
    }
  } else {
    clearTimeout(handle.id);
  }
};

/**
 * Document-persistence scheduler. Was previously a module of top-level
 * `let timer` / `let pending` globals — fine for the live app (there's
 * only ever one document being persisted), but tests had to thread
 * `cancelPendingPersist()` through their reset hooks to avoid stale
 * timers leaking. Wrapping as a class with a single exported singleton
 * keeps the public API identical while giving tests `new PersistScheduler()`
 * for isolation when they need it.
 */
export class PersistScheduler {
  private timer: ReturnType<typeof setTimeout> | null = null;
  // Session 107 — second handle for the idle-callback that runs the
  // actual canonical write. The debounce timer fires after
  // DEBOUNCE_MS of input quiet; THAT then schedules the write for
  // the next idle window via `requestIdleCallback`. Two-phase
  // scheduling so the heavy `JSON.stringify` is never in the same
  // frame as user input.
  private idleHandle: IdleHandle | null = null;
  private pending: TPDocument | null = null;

  /**
   * Queue a debounced write. The latest doc passed in wins; intermediate
   * snapshots are dropped. Returns immediately — call flushNow() if you
   * need synchronous persistence (Cmd+S, unload, document swap).
   */
  schedule(doc: TPDocument): void {
    this.pending = doc;
    // Always update the live draft synchronously so a crash within the
    // debounce window loses at most one keystroke.
    this.writeLiveDraft(doc);
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.scheduleIdleWrite(), DEBOUNCE_MS);
  }

  /**
   * Internal — called by the debounce timer. Hands the actual write
   * to `requestIdleCallback` so the `JSON.stringify` + `setItem`
   * burst lands during a main-thread idle gap rather than competing
   * with active input.
   */
  private scheduleIdleWrite(): void {
    this.timer = null;
    if (this.idleHandle !== null) cancelIdle(this.idleHandle);
    this.idleHandle = requestIdle(() => {
      this.idleHandle = null;
      this.writeNow();
    });
  }

  /** Synchronous canonical write. Used by flushNow + the idle callback. */
  private writeNow(): void {
    if (!this.pending) return;
    const doc = this.pending;
    this.pending = null;
    saveToLocalStorage(doc);
    // Once the canonical key is written, the live draft is redundant.
    removeKey(STORAGE_KEYS.docLive);
  }

  /**
   * Force any pending write to happen now. Synchronous on purpose:
   * used by Cmd+S, beforeunload, visibility-change, and document
   * swap — all moments where waiting for an idle window would risk
   * data loss.
   */
  flushNow(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.idleHandle !== null) {
      cancelIdle(this.idleHandle);
      this.idleHandle = null;
    }
    this.writeNow();
  }

  /**
   * Cancel any pending write without persisting. Used by tests in their
   * reset hook so a stale timer from a previous test can't write into
   * the next one.
   */
  cancel(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.idleHandle !== null) {
      cancelIdle(this.idleHandle);
      this.idleHandle = null;
    }
    this.pending = null;
  }

  /**
   * Live-draft writer (A5 — auto-recovery). Synchronous, no debounce.
   * Runs on every mutation alongside the debounced committed write, so
   * a tab crash between debounce ticks can still be recovered from
   * `docLive`. Best-effort: if quota / private-mode rejects the write,
   * the next committed write will still land via the debounce path.
   */
  private writeLiveDraft(doc: TPDocument): void {
    try {
      writeString(STORAGE_KEYS.docLive, exportToJSON(doc));
    } catch {
      /* swallow — debounced canonical write is the safety net. */
    }
  }
}

// Singleton instance for the live app. Tests can `new PersistScheduler()`
// for an isolated instance when needed.
const scheduler = new PersistScheduler();

export const persistDebounced = (doc: TPDocument): void => scheduler.schedule(doc);
export const flushPersist = (): void => scheduler.flushNow();
export const cancelPendingPersist = (): void => scheduler.cancel();

/**
 * Install browser-level flushers: beforeunload and visibility change both
 * fire before the page can be discarded, so anything still queued must
 * land synchronously. Returns an unsubscribe.
 */
export const installFlushOnLifecycleEvents = (): (() => void) => {
  if (typeof window === 'undefined') return () => {};
  const onBeforeUnload = () => scheduler.flushNow();
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') scheduler.flushNow();
  };
  window.addEventListener('beforeunload', onBeforeUnload);
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    window.removeEventListener('beforeunload', onBeforeUnload);
    document.removeEventListener('visibilitychange', onVisibility);
  };
};
