import { saveToLocalStorage } from '@/domain/persistence';
import type { TPDocument } from '@/domain/types';

// Idle window before we actually hit localStorage. A burst of mutations
// inside this window coalesces into one JSON.stringify + setItem call,
// which matters for large docs where serialization is non-trivial.
const DEBOUNCE_MS = 200;

let timer: ReturnType<typeof setTimeout> | null = null;
let pending: TPDocument | null = null;

const flushNow = (): void => {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  if (pending) {
    const doc = pending;
    pending = null;
    saveToLocalStorage(doc);
  }
};

/**
 * Queue a debounced write. The latest doc passed in wins; intermediate
 * snapshots are dropped. Returns immediately — call flushPersist() if you
 * need synchronous persistence (Cmd+S, unload, document swap).
 */
export const persistDebounced = (doc: TPDocument): void => {
  pending = doc;
  if (timer !== null) clearTimeout(timer);
  timer = setTimeout(flushNow, DEBOUNCE_MS);
};

/** Force any pending write to happen now. Safe to call when nothing is queued. */
export const flushPersist = (): void => {
  flushNow();
};

/**
 * Cancel any pending write without persisting. Used by tests in their reset
 * hook so a stale timer from a previous test can't write into the next one.
 */
export const cancelPendingPersist = (): void => {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  pending = null;
};

/**
 * Install browser-level flushers: beforeunload and visibility change both
 * fire before the page can be discarded, so anything still queued must
 * land synchronously. Returns an unsubscribe.
 */
export const installFlushOnLifecycleEvents = (): (() => void) => {
  if (typeof window === 'undefined') return () => {};
  const onBeforeUnload = () => flushNow();
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') flushNow();
  };
  window.addEventListener('beforeunload', onBeforeUnload);
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    window.removeEventListener('beforeunload', onBeforeUnload);
    document.removeEventListener('visibilitychange', onVisibility);
  };
};
