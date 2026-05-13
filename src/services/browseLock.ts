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
  state.showToast('info', 'Browse Lock is on — unlock to make changes.');
  return false;
};
