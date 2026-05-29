/**
 * Active-document state shaping — multi-doc tabs Phase 2, Batch 2.1.
 * See `docs/MULTI_DOC_TABS_PLAN.md` (Phase 2 detailed execution plan).
 *
 * The companion to `selectors.ts`'s `currentDoc` (the READ side): this is
 * the WRITE side. `activeDocState(nextDoc)` produces the four store fields
 * that must always move together whenever the active document changes:
 *
 *   - `doc`        — the working copy of the active tab (canonical write
 *                    target; what `currentDoc` returns; what the 212 read
 *                    sites subscribe to).
 *   - `docs`       — the open-document map, kept in lockstep with `doc`.
 *   - `activeDocId`— which entry in `docs` is live.
 *   - `tabOrder`   — left-to-right tab ordering.
 *
 * The invariant this helper guarantees after every write:
 *
 *     docs[activeDocId] === doc        (same reference)
 *     tabOrder.includes(activeDocId)
 *
 * In Phase 2 the app is still single-tab, so additionally
 * `tabOrder.length === 1`, `tabOrder[0] === doc.id`, and
 * `docs === { [doc.id]: doc }`. Every one of the six `state.doc` write
 * sites (makeApplyDocChange, setDocument, newDocument,
 * markSystemScopeNudgeShown, undo, redo) spreads this helper's result so
 * the mirror can never drift.
 *
 * Why a dedicated leaf module rather than `selectors.ts`: this is consumed
 * by both `docMutate.ts` and `historySlice.ts`, and `docMutate` already
 * imports from `historySlice` (`pushHistoryEntry`). Housing the helper in
 * a types-only leaf keeps the import graph acyclic. It also gives Phase 5's
 * tab actions (openTab / switchTab / reorderTabs) a natural home alongside
 * the single-tab shaper.
 *
 * Phase 5 note: when real multi-tab lands, `setDocument` / `newDocument`
 * stop using the single-entry rebuild here (they'll APPEND a tab instead,
 * per locked decision #6). Content edits + undo/redo keep using
 * `activeDocState` verbatim — they mutate the active tab in place, which is
 * exactly the single-entry-replace-by-same-id semantics this produces.
 */

import type { DocumentId, TPDocument } from '@/domain/types';

/** The four store fields that move together on every active-doc change. */
export type ActiveDocFields = {
  doc: TPDocument;
  docs: Record<DocumentId, TPDocument>;
  activeDocId: DocumentId;
  tabOrder: DocumentId[];
};

/**
 * Build the active-document state slice for `nextDoc`. Single-tab: the
 * open-document map and tab order collapse to the one document. Spread
 * the result into a Zustand `set({ ...activeDocState(next), ...rest })`.
 */
export const activeDocState = (nextDoc: TPDocument): ActiveDocFields => ({
  doc: nextDoc,
  docs: { [nextDoc.id]: nextDoc },
  activeDocId: nextDoc.id,
  tabOrder: [nextDoc.id],
});

/**
 * Multi-doc tabs Phase 5 (Batch 5.1) — put `nextDoc` into the ACTIVE tab,
 * leaving every OTHER open tab untouched. This is the multi-tab-safe
 * replacement for `activeDocState` at the "edit / replace the active doc"
 * sites (makeApplyDocChange, undo, redo, markSystemScopeNudgeShown,
 * setDocument, newDocument) — where the old collapse-to-one-tab behaviour
 * would have destroyed the other tabs on the next keystroke.
 *
 *   - Same id (`nextDoc.id === activeDocId`) — the common case (content
 *     edit, undo/redo, paste): replace the active tab's doc in place;
 *     `tabOrder` unchanged.
 *   - Different id (a replace-mode doc load, or undo across one): swap the
 *     active tab to the new doc, keeping its POSITION in `tabOrder` and
 *     dropping the old id from `docs`.
 *
 * In single-tab (`docs` has one entry) this is behaviourally identical to
 * `activeDocState`, so it's a no-op flip until real tabs exist (5.2+).
 */
export const setActiveDoc = (state: ActiveDocFields, nextDoc: TPDocument): ActiveDocFields => {
  if (nextDoc.id === state.activeDocId) {
    return {
      doc: nextDoc,
      docs: { ...state.docs, [nextDoc.id]: nextDoc },
      activeDocId: nextDoc.id,
      tabOrder: state.tabOrder,
    };
  }
  // Rekey: the active tab now holds a different-id doc. Keep its slot in
  // `tabOrder`; drop the old id from `docs`.
  const { [state.activeDocId]: _old, ...rest } = state.docs;
  return {
    doc: nextDoc,
    docs: { ...rest, [nextDoc.id]: nextDoc },
    activeDocId: nextDoc.id,
    tabOrder: state.tabOrder.map((id) => (id === state.activeDocId ? nextDoc.id : id)),
  };
};
