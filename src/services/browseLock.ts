import { useDocumentStore } from '@/store';

/**
 * Returns true when the document is currently locked for browsing.
 * Reads outside React subscriptions, so safe to call from event handlers.
 */
export const isBrowseLocked = (): boolean => useDocumentStore.getState().browseLocked;

/**
 * Gate a write attempt against Browse Lock. Returns true when the caller
 * may proceed, false when the action should be skipped. When skipped a
 * single toast is shown so the user knows why nothing happened.
 *
 * Keep callers minimal — only at UI entry points (keyboard handler, canvas
 * events, palette commands, inspector inputs). Slice actions stay pure so
 * undo/redo and tests are unaffected.
 */
export const guardWriteOrToast = (): boolean => {
  const state = useDocumentStore.getState();
  if (!state.browseLocked) return true;
  // Session 87 (S8) — spell out where to disable it. Pre-fix the
  // toast said "unlock to make changes" without telling the user
  // which control unlocks. Now points at the two entry paths: the
  // lock icon in the top-right toolbar OR Settings → Behavior.
  state.showToast(
    'info',
    'Browse Lock is on — click the lock icon in the top-right or open Settings → Behavior to unlock.'
  );
  return false;
};
