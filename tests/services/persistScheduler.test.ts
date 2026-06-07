import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TPDocument } from '@/domain/types';
import { docLiveKey } from '@/services/storage/keys';
import {
  cancelPendingPersist,
  flushPersist,
  installFlushOnLifecycleEvents,
  PersistScheduler,
  persistDebounced,
} from '@/services/storage/persistDebounced';
import { STORAGE_KEYS } from '@/services/storage/storage';
import { resetStoreForTest, useDocumentStore } from '@/store';

/**
 * `PersistScheduler` is the class behind `persistDebounced`. The live
 * app uses a module-level singleton (also exported as functions for
 * backward compatibility); these tests instantiate a fresh scheduler so
 * the assertions don't fight other tests' module-level timer state.
 *
 * Key invariants:
 *   - `schedule(doc)` writes the live-draft synchronously and the
 *     committed key after the debounce window.
 *   - `flushNow()` fast-paths the committed write and clears the live
 *     draft.
 *   - `cancel()` clears the timer without writing.
 */

beforeEach(() => {
  resetStoreForTest();
  globalThis.localStorage.clear();
});

const someDoc = (): TPDocument => useDocumentStore.getState().doc;

// ─── Isolated PersistScheduler instances ──────────────────────────────────────

describe('PersistScheduler', () => {
  it('writes the live draft synchronously on schedule', () => {
    const scheduler = new PersistScheduler();
    const doc = someDoc();
    scheduler.schedule(doc);
    const live = globalThis.localStorage.getItem(STORAGE_KEYS.docLive);
    expect(live).not.toBeNull();
    // Perf #25 — the live draft is now serialized COMPACT (no indentation),
    // matching the committed slot; pretty-print stays for file exports.
    expect(live).toBe(JSON.stringify(doc));
    scheduler.cancel();
  });

  it('writes the committed key on flushNow and clears the live draft', () => {
    const scheduler = new PersistScheduler();
    const doc = someDoc();
    scheduler.schedule(doc);
    expect(globalThis.localStorage.getItem(STORAGE_KEYS.doc)).toBeNull();
    scheduler.flushNow();
    // Session 135 / Perf #26 — the committed slot is stored COMPACT
    // (`JSON.stringify` without indentation); pretty-printing is reserved
    // for human-facing file exports (`exportToJSON`). The live-draft slot
    // (asserted above) is unchanged.
    expect(globalThis.localStorage.getItem(STORAGE_KEYS.doc)).toBe(JSON.stringify(doc));
    expect(globalThis.localStorage.getItem(STORAGE_KEYS.docLive)).toBeNull();
  });

  it('cancel() prevents the pending committed write', async () => {
    const scheduler = new PersistScheduler();
    scheduler.schedule(someDoc());
    scheduler.cancel();
    // Wait past the debounce window to make sure no late write fires.
    await new Promise((r) => setTimeout(r, 250));
    expect(globalThis.localStorage.getItem(STORAGE_KEYS.doc)).toBeNull();
  });

  it('two schedulers maintain independent state', () => {
    const a = new PersistScheduler();
    const b = new PersistScheduler();
    a.schedule(someDoc());
    // b.cancel() must not affect a's pending write.
    b.cancel();
    a.flushNow();
    expect(globalThis.localStorage.getItem(STORAGE_KEYS.doc)).not.toBeNull();
  });

  it('flushNow with nothing pending is a safe no-op', () => {
    const scheduler = new PersistScheduler();
    expect(() => scheduler.flushNow()).not.toThrow();
    expect(globalThis.localStorage.getItem(STORAGE_KEYS.doc)).toBeNull();
  });
});

// ─── Fake-timer tests — debounce timing and coalescing ────────────────────────

describe('PersistScheduler — fake timers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does NOT write the committed key before the debounce window elapses', () => {
    const scheduler = new PersistScheduler();
    const doc = someDoc();
    scheduler.schedule(doc);

    // Advance less than DEBOUNCE_MS (200 ms). No committed write yet.
    vi.advanceTimersByTime(199);
    expect(globalThis.localStorage.getItem(STORAGE_KEYS.doc)).toBeNull();

    // Live draft IS already written synchronously.
    expect(globalThis.localStorage.getItem(STORAGE_KEYS.docLive)).toBe(JSON.stringify(doc));

    scheduler.cancel();
  });

  it('writes the committed key after the debounce window elapses (via idle callback)', () => {
    const scheduler = new PersistScheduler();
    const doc = someDoc();
    scheduler.schedule(doc);

    // Run all timers (debounce + any setTimeout(0) idle fallback).
    vi.runAllTimers();

    expect(globalThis.localStorage.getItem(STORAGE_KEYS.doc)).toBe(JSON.stringify(doc));
    // Live draft is cleaned up after the committed write.
    expect(globalThis.localStorage.getItem(STORAGE_KEYS.docLive)).toBeNull();
  });

  it('coalesces rapid calls — only the latest doc is persisted', () => {
    const scheduler = new PersistScheduler();
    const store = useDocumentStore.getState();
    const docA = { ...store.doc, title: 'first' };
    const docB = { ...store.doc, title: 'second' };

    scheduler.schedule(docA);
    // Advance partway — still inside debounce window.
    vi.advanceTimersByTime(100);
    scheduler.schedule(docB);

    // Run all timers — only one committed write should happen.
    vi.runAllTimers();

    const committed = globalThis.localStorage.getItem(STORAGE_KEYS.doc);
    expect(committed).not.toBeNull();
    const parsed = JSON.parse(committed!);
    expect(parsed.title).toBe('second'); // latest doc wins
  });

  it('coalesces three rapid calls — only the last doc survives', () => {
    const scheduler = new PersistScheduler();
    const base = useDocumentStore.getState().doc;
    const docA = { ...base, title: 'a' };
    const docB = { ...base, title: 'b' };
    const docC = { ...base, title: 'c' };

    scheduler.schedule(docA);
    vi.advanceTimersByTime(50);
    scheduler.schedule(docB);
    vi.advanceTimersByTime(50);
    scheduler.schedule(docC);

    vi.runAllTimers();

    const committed = globalThis.localStorage.getItem(STORAGE_KEYS.doc);
    expect(JSON.parse(committed!).title).toBe('c');
  });

  it('flushNow with pending write causes immediate write + cancels the debounce timer', () => {
    const scheduler = new PersistScheduler();
    const doc = someDoc();
    scheduler.schedule(doc);

    // Only advance part-way — debounce hasn't fired yet.
    vi.advanceTimersByTime(100);
    expect(globalThis.localStorage.getItem(STORAGE_KEYS.doc)).toBeNull();

    // flushNow cancels the pending timer and writes immediately.
    scheduler.flushNow();
    expect(globalThis.localStorage.getItem(STORAGE_KEYS.doc)).toBe(JSON.stringify(doc));
    // Live draft cleared.
    expect(globalThis.localStorage.getItem(STORAGE_KEYS.docLive)).toBeNull();

    // Running all remaining timers should NOT trigger a second write.
    vi.runAllTimers();
    // committed slot is still the same single write.
    expect(globalThis.localStorage.getItem(STORAGE_KEYS.doc)).toBe(JSON.stringify(doc));
  });

  it('flushNow with no pending write is a safe no-op (fake timers)', () => {
    const scheduler = new PersistScheduler();
    expect(() => scheduler.flushNow()).not.toThrow();
    expect(globalThis.localStorage.getItem(STORAGE_KEYS.doc)).toBeNull();
  });

  it('cancel() with pending debounce timer — no committed write fires', () => {
    const scheduler = new PersistScheduler();
    scheduler.schedule(someDoc());

    vi.advanceTimersByTime(50);
    scheduler.cancel();

    // Run remaining timers — cancel must have cleared the debounce timer.
    vi.runAllTimers();
    expect(globalThis.localStorage.getItem(STORAGE_KEYS.doc)).toBeNull();
    // The live draft was written synchronously on schedule() and is NOT
    // removed by cancel() — cancel only prevents the committed write.
    expect(globalThis.localStorage.getItem(STORAGE_KEYS.docLive)).not.toBeNull();
  });

  it('cancel() with nothing pending is a safe no-op', () => {
    const scheduler = new PersistScheduler();
    expect(() => scheduler.cancel()).not.toThrow();
  });

  it('re-scheduling after cancel restarts the debounce from scratch', () => {
    const scheduler = new PersistScheduler();
    const base = useDocumentStore.getState().doc;

    scheduler.schedule({ ...base, title: 'before-cancel' });
    scheduler.cancel();
    expect(globalThis.localStorage.getItem(STORAGE_KEYS.doc)).toBeNull();

    const docAfter = { ...base, title: 'after-cancel' };
    scheduler.schedule(docAfter);
    vi.runAllTimers();

    const committed = globalThis.localStorage.getItem(STORAGE_KEYS.doc);
    expect(JSON.parse(committed!).title).toBe('after-cancel');
  });

  it('second schedule within the window resets the debounce timer', () => {
    const scheduler = new PersistScheduler();
    const base = useDocumentStore.getState().doc;
    scheduler.schedule({ ...base, title: 'early' });

    // Advance almost to the debounce boundary, then reschedule.
    vi.advanceTimersByTime(180);
    scheduler.schedule({ ...base, title: 'late' });

    // Advance just 20 ms more — the FIRST timer would have fired, but it was
    // cleared; the new timer still needs 200 ms from the second call.
    vi.advanceTimersByTime(20);
    // Too soon: only 20 ms past the second schedule call.
    expect(globalThis.localStorage.getItem(STORAGE_KEYS.doc)).toBeNull();

    // Now run all timers to completion.
    vi.runAllTimers();
    expect(JSON.parse(globalThis.localStorage.getItem(STORAGE_KEYS.doc)!).title).toBe('late');
  });

  it('writes both the legacy live key and the per-doc live key on schedule', () => {
    const scheduler = new PersistScheduler();
    const doc = someDoc();
    scheduler.schedule(doc);

    const legacyLive = globalThis.localStorage.getItem(STORAGE_KEYS.docLive);
    const perDocLive = globalThis.localStorage.getItem(docLiveKey(doc.id));
    expect(legacyLive).toBe(JSON.stringify(doc));
    expect(perDocLive).toBe(JSON.stringify(doc));

    scheduler.cancel();
  });

  it('flushNow clears both legacy and per-doc live keys', () => {
    const scheduler = new PersistScheduler();
    const doc = someDoc();
    scheduler.schedule(doc);

    scheduler.flushNow();

    expect(globalThis.localStorage.getItem(STORAGE_KEYS.docLive)).toBeNull();
    expect(globalThis.localStorage.getItem(docLiveKey(doc.id))).toBeNull();
  });

  it('flushNow cancels the idle handle if debounce already fired', () => {
    const scheduler = new PersistScheduler();
    const doc = someDoc();
    scheduler.schedule(doc);

    // Advance past DEBOUNCE_MS so the debounce fires and schedules an idle
    // setTimeout(0). Do NOT run the idle timer yet.
    vi.advanceTimersByTime(200);
    // At this point the debounce timer has fired; the committed write is
    // waiting in an idle setTimeout. No committed write yet.
    expect(globalThis.localStorage.getItem(STORAGE_KEYS.doc)).toBeNull();

    // flushNow should cancel the idle timer and write synchronously.
    scheduler.flushNow();
    expect(globalThis.localStorage.getItem(STORAGE_KEYS.doc)).toBe(JSON.stringify(doc));

    // Running any remaining timers must not produce a duplicate write.
    vi.runAllTimers();
    expect(globalThis.localStorage.getItem(STORAGE_KEYS.doc)).toBe(JSON.stringify(doc));
  });

  it('cancel() also cancels the idle handle if debounce already fired', () => {
    const scheduler = new PersistScheduler();
    scheduler.schedule(someDoc());

    // Let the debounce fire; idle timer now pending.
    vi.advanceTimersByTime(200);
    expect(globalThis.localStorage.getItem(STORAGE_KEYS.doc)).toBeNull();

    scheduler.cancel();

    // Idle timer was cancelled — running remaining timers should not write.
    vi.runAllTimers();
    expect(globalThis.localStorage.getItem(STORAGE_KEYS.doc)).toBeNull();
  });
});

// ─── requestIdleCallback branch (when browser supports it) ───────────────────

describe('PersistScheduler — requestIdleCallback available', () => {
  type WindowWithIdle = Window &
    typeof globalThis & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

  let originalRic: WindowWithIdle['requestIdleCallback'];
  let originalCic: WindowWithIdle['cancelIdleCallback'];
  let capturedIdleCallbacks: Array<() => void>;

  beforeEach(() => {
    vi.useFakeTimers();
    capturedIdleCallbacks = [];
    const w = window as WindowWithIdle;
    originalRic = w.requestIdleCallback;
    originalCic = w.cancelIdleCallback;

    // Stub requestIdleCallback: capture callbacks for manual invocation.
    // Cast through unknown to bypass the IdleRequestCallback overload mismatch
    // — we only need the no-arg invocation pattern that the source uses.
    let idCounter = 0;
    w.requestIdleCallback = ((cb: () => void) => {
      capturedIdleCallbacks.push(cb);
      return ++idCounter;
    }) as unknown as WindowWithIdle['requestIdleCallback'];
    w.cancelIdleCallback = vi.fn();
  });

  afterEach(() => {
    const w = window as WindowWithIdle;
    w.requestIdleCallback = originalRic;
    w.cancelIdleCallback = originalCic;
    vi.useRealTimers();
    globalThis.localStorage.clear();
  });

  it('schedules via requestIdleCallback after the debounce fires', () => {
    const scheduler = new PersistScheduler();
    const doc = someDoc();
    scheduler.schedule(doc);

    // Advance past debounce — debounce fires, which calls requestIdleCallback.
    vi.advanceTimersByTime(200);

    // requestIdleCallback has been called with our write callback.
    expect(capturedIdleCallbacks.length).toBe(1);
    // Committed write has NOT happened yet — we haven't invoked the idle cb.
    expect(globalThis.localStorage.getItem(STORAGE_KEYS.doc)).toBeNull();

    // Manually fire the idle callback (browser would do this at idle time).
    const idleCb = capturedIdleCallbacks[0];
    expect(idleCb).toBeDefined();
    idleCb?.();
    expect(globalThis.localStorage.getItem(STORAGE_KEYS.doc)).toBe(JSON.stringify(doc));
  });

  it('cancelIdleCallback is called when flushNow cancels an idle handle', () => {
    const scheduler = new PersistScheduler();
    scheduler.schedule(someDoc());

    // Let debounce fire → requestIdleCallback invoked.
    vi.advanceTimersByTime(200);
    expect(capturedIdleCallbacks.length).toBe(1);

    scheduler.flushNow();

    // cancelIdleCallback must have been called to cancel the pending idle cb.
    expect((window as WindowWithIdle).cancelIdleCallback).toHaveBeenCalled();
    // And the committed write happened synchronously.
    expect(globalThis.localStorage.getItem(STORAGE_KEYS.doc)).not.toBeNull();
  });

  it('cancelIdleCallback is called when cancel() cancels an idle handle', () => {
    const scheduler = new PersistScheduler();
    scheduler.schedule(someDoc());

    vi.advanceTimersByTime(200);
    expect(capturedIdleCallbacks.length).toBe(1);

    scheduler.cancel();

    expect((window as WindowWithIdle).cancelIdleCallback).toHaveBeenCalled();
    // No committed write.
    expect(globalThis.localStorage.getItem(STORAGE_KEYS.doc)).toBeNull();
  });
});

// ─── writeLiveDraft error-swallowing ─────────────────────────────────────────

describe('PersistScheduler — writeLiveDraft error swallowing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.localStorage.clear();
  });

  it('swallows a localStorage write error in writeLiveDraft and continues', () => {
    const scheduler = new PersistScheduler();
    const doc = someDoc();

    // Make localStorage.setItem throw for the first call only (the live draft).
    const original = globalThis.localStorage.setItem.bind(globalThis.localStorage);
    let callCount = 0;
    vi.spyOn(globalThis.localStorage, 'setItem').mockImplementation(
      (key: string, value: string) => {
        callCount++;
        if (callCount <= 2) throw new DOMException('QuotaExceededError', 'QuotaExceededError');
        original(key, value);
      }
    );

    // schedule() should not throw even if writeLiveDraft fails.
    expect(() => scheduler.schedule(doc)).not.toThrow();

    vi.restoreAllMocks();
    scheduler.cancel();
  });
});

// ─── Module-level singleton exports ──────────────────────────────────────────

describe('module-level singleton exports', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Clean up the singleton's state before each test.
    cancelPendingPersist();
    globalThis.localStorage.clear();
  });

  afterEach(() => {
    cancelPendingPersist();
    vi.useRealTimers();
    globalThis.localStorage.clear();
  });

  it('persistDebounced writes the live draft synchronously', () => {
    const doc = someDoc();
    persistDebounced(doc);
    expect(globalThis.localStorage.getItem(STORAGE_KEYS.docLive)).toBe(JSON.stringify(doc));
  });

  it('flushPersist forces the committed write immediately', () => {
    const doc = someDoc();
    persistDebounced(doc);
    expect(globalThis.localStorage.getItem(STORAGE_KEYS.doc)).toBeNull();
    flushPersist();
    expect(globalThis.localStorage.getItem(STORAGE_KEYS.doc)).toBe(JSON.stringify(doc));
  });

  it('flushPersist with no pending write is a safe no-op', () => {
    expect(() => flushPersist()).not.toThrow();
    expect(globalThis.localStorage.getItem(STORAGE_KEYS.doc)).toBeNull();
  });

  it('cancelPendingPersist clears the pending write — no committed write fires', () => {
    persistDebounced(someDoc());
    cancelPendingPersist();
    vi.runAllTimers();
    expect(globalThis.localStorage.getItem(STORAGE_KEYS.doc)).toBeNull();
  });

  it('persistDebounced coalesces when called multiple times before debounce fires', () => {
    const base = useDocumentStore.getState().doc;
    persistDebounced({ ...base, title: 'first-singleton' });
    vi.advanceTimersByTime(50);
    persistDebounced({ ...base, title: 'second-singleton' });
    vi.runAllTimers();
    const committed = globalThis.localStorage.getItem(STORAGE_KEYS.doc);
    expect(JSON.parse(committed!).title).toBe('second-singleton');
  });
});

// ─── installFlushOnLifecycleEvents ────────────────────────────────────────────

describe('installFlushOnLifecycleEvents', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    cancelPendingPersist();
    globalThis.localStorage.clear();
  });

  afterEach(() => {
    cancelPendingPersist();
    vi.useRealTimers();
    globalThis.localStorage.clear();
  });

  it('flushes on beforeunload when a write is pending', () => {
    const doc = someDoc();
    persistDebounced(doc);
    expect(globalThis.localStorage.getItem(STORAGE_KEYS.doc)).toBeNull();

    const uninstall = installFlushOnLifecycleEvents();

    // Simulate beforeunload.
    window.dispatchEvent(new Event('beforeunload'));
    expect(globalThis.localStorage.getItem(STORAGE_KEYS.doc)).toBe(JSON.stringify(doc));

    uninstall();
  });

  it('flushes on visibilitychange to hidden when a write is pending', () => {
    const doc = someDoc();
    persistDebounced(doc);

    const uninstall = installFlushOnLifecycleEvents();

    // Simulate tab hide.
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(globalThis.localStorage.getItem(STORAGE_KEYS.doc)).toBe(JSON.stringify(doc));

    // Restore.
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
    uninstall();
  });

  it('does NOT flush on visibilitychange when tab becomes visible', () => {
    const doc = someDoc();
    persistDebounced(doc);

    const uninstall = installFlushOnLifecycleEvents();

    // Simulate becoming visible (not hidden).
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
    // No committed write when becoming visible.
    expect(globalThis.localStorage.getItem(STORAGE_KEYS.doc)).toBeNull();

    uninstall();
    cancelPendingPersist();
  });

  it('uninstall removes event listeners — no flush fires after unsubscribe', () => {
    const doc = someDoc();
    persistDebounced(doc);

    const uninstall = installFlushOnLifecycleEvents();
    uninstall();

    // After uninstall, beforeunload should NOT flush.
    window.dispatchEvent(new Event('beforeunload'));
    // The debounce timer is still pending but no synchronous flush.
    expect(globalThis.localStorage.getItem(STORAGE_KEYS.doc)).toBeNull();

    cancelPendingPersist();
  });

  it('returns a no-op unsubscribe when window is undefined', () => {
    // installFlushOnLifecycleEvents guards typeof window === 'undefined'.
    // In jsdom, window is always defined, so this branch is not reachable.
    // Verify the function still returns a callable unsubscribe.
    const uninstall = installFlushOnLifecycleEvents();
    expect(typeof uninstall).toBe('function');
    expect(() => uninstall()).not.toThrow();
  });
});
