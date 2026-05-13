import { exportToJSON, saveToLocalStorage } from '@/domain/persistence';
import type { TPDocument } from '@/domain/types';
import { STORAGE_KEYS, removeKey, writeString } from './storage';

// Idle window before we hit the committed doc key. A burst of mutations
// inside this window coalesces into one JSON.stringify + setItem call,
// which matters for large docs where serialization is non-trivial.
const DEBOUNCE_MS = 200;

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
    this.timer = setTimeout(() => this.flushNow(), DEBOUNCE_MS);
  }

  /** Force any pending write to happen now. Safe to call when nothing is queued. */
  flushNow(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.pending) {
      const doc = this.pending;
      this.pending = null;
      saveToLocalStorage(doc);
      // Once the canonical key is written, the live draft is redundant.
      removeKey(STORAGE_KEYS.docLive);
    }
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
