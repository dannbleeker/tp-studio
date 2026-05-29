import type { TPDocument } from '@/domain/types';

/**
 * Shared post-load toast options for the "open a document" dialogs
 * (pattern library / template picker / diagram-example picker).
 *
 * Decision #6 (Session 138, multi-doc tabs): when a load opens a NEW tab
 * there is nothing to undo-by-restore — closing the tab is the undo — so
 * the "Undo" affordance (which rolls the active doc back to `previousDoc`
 * via `setDocument`) is offered ONLY when the load REPLACED the active
 * document (the opt-out "replace" mode).
 *
 * Returns a value shaped for `showToast`'s third argument: the Undo action
 * in replace mode, or `undefined` (no action) in new-tab mode.
 */
export const undoRestoreAction = (
  openedNewTab: boolean,
  previousDoc: TPDocument,
  setDocument: (doc: TPDocument) => void
): { action: { label: string; run: () => void } } | undefined =>
  openedNewTab ? undefined : { action: { label: 'Undo', run: () => setDocument(previousDoc) } };
