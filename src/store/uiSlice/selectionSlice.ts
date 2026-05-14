import type { EdgeId, EntityId, GroupId } from '@/domain/types';
import type { StateCreator } from 'zustand';
import type { RootStore } from '../types';
import type { Selection } from './types';

/**
 * Selection state and the "currently editing inline" cursor, plus hoist
 * (which is selection-adjacent — entering a hoist clears selection so the
 * inspector doesn't dangle on something outside the hoisted scope).
 *
 * Stays a separate sub-slice from preferences / dialogs because these
 * fields churn on every click and shouldn't share render-fanout with the
 * persisted prefs that practically never change.
 */
export type SelectionSlice = {
  selection: Selection;
  editingEntityId: string | null;
  /** Hoist-into-group state. When non-null, the canvas filters to that
   *  group's transitive entity members; cross-boundary edges become stubs. */
  hoistedGroupId: string | null;

  select: (sel: Selection) => void;
  selectEntity: (id: string) => void;
  selectEdge: (id: string) => void;
  /** Session 85 (#1) — branded group selection. Previously groups were
   *  shoehorned into the `entities` variant via an `as unknown as EntityId`
   *  cast at every call site. The dedicated `groups` variant + this
   *  action let callers stay honest about what's selected. */
  selectGroup: (id: string) => void;
  selectEntities: (ids: string[]) => void;
  selectEdges: (ids: string[]) => void;
  toggleEntitySelection: (id: string) => void;
  toggleEdgeSelection: (id: string) => void;
  clearSelection: () => void;
  beginEditing: (id: string) => void;
  endEditing: () => void;

  hoistGroup: (id: string) => void;
  unhoist: () => void;
};

export type SelectionDataKeys = 'selection' | 'editingEntityId' | 'hoistedGroupId';

export const selectionDefaults = (): Pick<SelectionSlice, SelectionDataKeys> => ({
  selection: { kind: 'none' },
  editingEntityId: null,
  hoistedGroupId: null,
});

const toggleId = (ids: string[], id: string): string[] =>
  ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];

export const createSelectionSlice: StateCreator<RootStore, [], [], SelectionSlice> = (
  set,
  get
) => ({
  selection: { kind: 'none' },
  editingEntityId: null,
  hoistedGroupId: null,

  select: (selection) => set({ selection }),
  // The action surface still accepts plain `string` because selection
  // ids commonly arrive from React Flow events, BFS reach sets, and
  // other places where the brand has been lost. We cast at this single
  // boundary so the `Selection` value the store holds carries the
  // correct branded types downstream.
  selectEntity: (id) => set({ selection: { kind: 'entities', ids: [id as EntityId] } }),
  selectEdge: (id) => set({ selection: { kind: 'edges', ids: [id as EdgeId] } }),
  selectGroup: (id) => set({ selection: { kind: 'groups', ids: [id as GroupId] } }),
  selectEntities: (ids) =>
    set({
      selection: ids.length ? { kind: 'entities', ids: ids as EntityId[] } : { kind: 'none' },
    }),
  selectEdges: (ids) =>
    set({ selection: ids.length ? { kind: 'edges', ids: ids as EdgeId[] } : { kind: 'none' } }),
  toggleEntitySelection: (id) => {
    const cur = get().selection;
    if (cur.kind === 'entities') {
      const next = toggleId(cur.ids, id);
      set({
        selection: next.length ? { kind: 'entities', ids: next as EntityId[] } : { kind: 'none' },
      });
    } else {
      set({ selection: { kind: 'entities', ids: [id as EntityId] } });
    }
  },
  toggleEdgeSelection: (id) => {
    const cur = get().selection;
    if (cur.kind === 'edges') {
      const next = toggleId(cur.ids, id);
      set({
        selection: next.length ? { kind: 'edges', ids: next as EdgeId[] } : { kind: 'none' },
      });
    } else {
      set({ selection: { kind: 'edges', ids: [id as EdgeId] } });
    }
  },
  clearSelection: () => set({ selection: { kind: 'none' } }),
  beginEditing: (id) =>
    set({ editingEntityId: id, selection: { kind: 'entities', ids: [id as EntityId] } }),
  endEditing: () => set({ editingEntityId: null }),

  hoistGroup: (id) => {
    // Cross-slice read: the doc lives in documentSlice. The combined root
    // store exposes both, so `get()` resolves the doc and the group lookup
    // works without circular slice imports.
    const doc = get().doc;
    if (!doc.groups[id]) return;
    set({ hoistedGroupId: id, selection: { kind: 'none' } });
  },
  unhoist: () => set({ hoistedGroupId: null }),
});
