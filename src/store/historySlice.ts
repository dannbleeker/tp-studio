import type { StateCreator } from 'zustand';
import { COALESCE_WINDOW_MS, HISTORY_LIMIT } from '@/domain/constants';
import type { DocumentId, TPDocument } from '@/domain/types';
import { persistDebounced } from '@/services/storage/persistDebounced';
import { setActiveDoc } from './activeDoc';
import { currentDoc } from './selectors';
import type { RootStore } from './types';

export type HistoryEntry = {
  doc: TPDocument;
  coalesceKey?: string;
  t: number;
};

/** A single document's undo/redo stacks. The ACTIVE tab's stacks live in
 *  the top-level `past`/`future`; INACTIVE tabs park theirs in
 *  `historyByDoc` (Batch 2.3). */
export type DocHistory = { past: HistoryEntry[]; future: HistoryEntry[] };

export type HistorySlice = {
  past: HistoryEntry[];
  future: HistoryEntry[];
  /** Multi-doc tabs Phase 3 (Batch 2.3) — parked undo/redo stacks for
   *  INACTIVE tabs, keyed by doc id. The ACTIVE tab's stacks stay live in
   *  `past`/`future` (canonical), so single-tab behaviour is unchanged and
   *  every existing undo/redo read works untouched. Phase 5's `switchTab`
   *  calls `applyTabSwitchHistory` to swap a tab's stacks in/out of the
   *  top-level fields on switch. In single-tab this map stays empty. See
   *  `docs/MULTI_DOC_TABS_PLAN.md`. */
  historyByDoc: Record<DocumentId, DocHistory>;
  undo: () => void;
  redo: () => void;
};

/**
 * Pure helper. Returns a new past stack with `entry` appended, except when
 * `entry.coalesceKey` matches the last entry and falls within the coalesce
 * window — in that case the existing "before" snapshot is kept so a burst of
 * same-field edits collapses into one undo step.
 */
export const pushHistoryEntry = (past: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] => {
  const last = past[past.length - 1];
  if (
    entry.coalesceKey &&
    last?.coalesceKey === entry.coalesceKey &&
    entry.t - last.t < COALESCE_WINDOW_MS
  ) {
    return past;
  }
  return [...past, entry].slice(-HISTORY_LIMIT);
};

/** Park `stacks` under `docId` in the per-doc history map. Overwrites any
 *  prior parked stacks for that id. Internal building block of
 *  `applyTabSwitchHistory`. */
export const stashHistory = (
  historyByDoc: Record<DocumentId, DocHistory>,
  docId: DocumentId,
  stacks: DocHistory
): Record<DocumentId, DocHistory> => ({ ...historyByDoc, [docId]: stacks });

/** Parked stacks for `docId`, or empty stacks when the tab has none yet
 *  (freshly opened / never edited). Internal building block of
 *  `applyTabSwitchHistory`. */
const restoreHistory = (
  historyByDoc: Record<DocumentId, DocHistory>,
  docId: DocumentId
): DocHistory => historyByDoc[docId] ?? { past: [], future: [] };

/**
 * Compute the history-slice fields for a tab switch (Batch 2.3 — used by
 * Phase 5's `switchTab`; no caller yet while the app is single-tab).
 *
 * Parks the LEAVING tab's live stacks under its id, promotes the ENTERING
 * tab's parked stacks to the live `past`/`future` (empty if it has none),
 * and drops the entering tab's now-redundant parked copy so it can't go
 * stale. A no-op switch (`leavingId === enteringId`) preserves the live
 * stacks and just cleans the map.
 */
export const applyTabSwitchHistory = (
  historyByDoc: Record<DocumentId, DocHistory>,
  leavingId: DocumentId,
  liveStacks: DocHistory,
  enteringId: DocumentId
): { historyByDoc: Record<DocumentId, DocHistory> } & DocHistory => {
  const parked = stashHistory(historyByDoc, leavingId, liveStacks);
  const entering = restoreHistory(parked, enteringId);
  const { [enteringId]: _promoted, ...rest } = parked;
  return { historyByDoc: rest, past: entering.past, future: entering.future };
};

/**
 * Data-only defaults for this slice. Used by resetStoreForTest.
 */
export const historyDefaults = (): Pick<HistorySlice, 'past' | 'future' | 'historyByDoc'> => ({
  past: [],
  future: [],
  historyByDoc: {},
});

export const createHistorySlice: StateCreator<RootStore, [], [], HistorySlice> = (set, get) => ({
  past: [],
  future: [],
  historyByDoc: {},

  undo: () => {
    const state = get();
    const { past, future } = state;
    const doc = currentDoc(state);
    const last = past[past.length - 1];
    if (!last) return;
    persistDebounced(last.doc);
    // Batch 5.1 — undo may restore a doc with a DIFFERENT id (undoing a
    // replace-mode setDocument). `setActiveDoc` swaps the ACTIVE tab to the
    // restored doc (rekeying if the id changed) while leaving every other
    // open tab untouched.
    set({
      ...setActiveDoc(state, last.doc),
      past: past.slice(0, -1),
      future: [...future, { doc, t: Date.now() }],
      editingEntityId: null,
      // Clear selection: the restored doc may not contain the selected ids
      // (e.g. undoing an add, whose id no longer exists), and a stale id
      // would drive the toolbar / bulk actions against a missing entity.
      // Matches how delete + document-swap already reset selection.
      selection: { kind: 'none' },
    });
  },

  redo: () => {
    const state = get();
    const { future, past } = state;
    const doc = currentDoc(state);
    const next = future[future.length - 1];
    if (!next) return;
    persistDebounced(next.doc);
    // Batch 5.1 — symmetric with undo: redo may restore a different doc
    // id, so route through `setActiveDoc` (active-tab swap, other tabs
    // untouched).
    set({
      ...setActiveDoc(state, next.doc),
      future: future.slice(0, -1),
      past: [...past, { doc, t: Date.now() }],
      editingEntityId: null,
      // Symmetric with undo — the redone doc may not contain the selected
      // ids, so clear rather than leave a dangling selection.
      selection: { kind: 'none' },
    });
  },
});
