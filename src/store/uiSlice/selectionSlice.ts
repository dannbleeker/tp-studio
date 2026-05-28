import type { StateCreator } from 'zustand';
import type { EdgeId, EntityId, GroupId } from '@/domain/types';
import { currentDoc } from '../selectors';
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
  /** Session 101 — mid-gesture splice-target highlight.
   *
   *  When the user Alt-drags a node and it hovers over a splice-target
   *  edge, `Canvas.tsx` sets this to that edge's id; `TPEdge` reads it
   *  and renders a thicker stroke + indigo glow so the gesture is
   *  *discoverable* (Session 83 shipped Alt+drag-splice but no visual
   *  hint, so users didn't find it). Cleared on drag-stop and on any
   *  drag without the Alt modifier. This is transient gesture state,
   *  not persisted. */
  spliceTargetEdgeId: string | null;

  /** Session 133 — edge-join mode. When non-null, the next edge click
   *  on the canvas attempts to AND-group the held edge with the
   *  clicked one. Discoverable substitute for a "drag-edge-onto-edge"
   *  gesture (which React Flow doesn't support natively because edges
   *  have no drag handles). Entered via the selection-toolbar verb
   *  "AND-join with another edge…" on a single-edge selection; exits
   *  on completion, on Esc, on pane click, or on the verb a second
   *  time. */
  joinModeEdgeId: string | null;

  /** Session 135 — a11y slice 5. Keyboard edge-creation mode. While set,
   *  the canvas is in "pick a target" mode: the user selected a source
   *  entity, invoked `Create edge from selected entity` via the palette,
   *  and now needs to pick a target. `completePendingEdge(targetId)`
   *  creates the edge via the existing `connect` action and clears the
   *  state; `cancelPendingEdge()` clears without creating. The Esc
   *  cascade clears it ahead of join-mode + hoist + selection. */
  pendingEdgeSourceId: string | null;

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

  /** Session 101 — set the highlighted splice-target edge id (or
   *  clear it with `null`). Called from `Canvas.tsx`'s
   *  `onNodeDrag` / `onNodeDragStop` handlers. The action is a
   *  no-op when the value is already what's requested, so the
   *  per-frame call during a drag doesn't fan re-renders unless
   *  the target actually changed. */
  setSpliceTargetEdge: (edgeId: string | null) => void;

  /** Session 133 — enter / exit edge-join mode. `startEdgeJoinMode`
   *  remembers the source edge id; the next edge click on the canvas
   *  attempts the AND-group via the existing `groupAsAnd` action and
   *  then exits the mode regardless of outcome. */
  startEdgeJoinMode: (edgeId: string) => void;
  cancelEdgeJoinMode: () => void;

  /** Session 135 — a11y slice 5. Enter keyboard edge-creation mode with
   *  the given source entity id. The next `completePendingEdge(targetId)`
   *  creates the edge via the document store's `connect(sourceId,
   *  targetId)` action and clears the pending state. Returns the new
   *  edge id (or null if connect rejected, e.g. self-loop / duplicate). */
  startPendingEdge: (sourceId: string) => void;
  cancelPendingEdge: () => void;
  completePendingEdge: (targetId: string) => string | null;
};

export type SelectionDataKeys =
  | 'selection'
  | 'editingEntityId'
  | 'hoistedGroupId'
  | 'spliceTargetEdgeId'
  | 'joinModeEdgeId'
  | 'pendingEdgeSourceId';

export const selectionDefaults = (): Pick<SelectionSlice, SelectionDataKeys> => ({
  selection: { kind: 'none' },
  editingEntityId: null,
  hoistedGroupId: null,
  spliceTargetEdgeId: null,
  joinModeEdgeId: null,
  pendingEdgeSourceId: null,
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
  spliceTargetEdgeId: null,
  joinModeEdgeId: null,
  pendingEdgeSourceId: null,

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
    // Cross-slice read: the doc lives in documentSlice. The combined
    // root store exposes both. Session 137 / multi-doc Batch 1 routes
    // through `currentDoc()` so a future swap of the data model is
    // one-line.
    const doc = currentDoc(get());
    if (!doc.groups[id]) return;
    set({ hoistedGroupId: id, selection: { kind: 'none' } });
  },
  unhoist: () => set({ hoistedGroupId: null }),

  setSpliceTargetEdge: (edgeId) => {
    // Bail-early if the value is already what's requested. `onNodeDrag`
    // fires ~60 times per second; without this guard every frame would
    // notify subscribers (every visible TPEdge subscribes to
    // `spliceTargetEdgeId === props.id`), thrashing reconciliation.
    if (get().spliceTargetEdgeId === edgeId) return;
    set({ spliceTargetEdgeId: edgeId });
  },

  startEdgeJoinMode: (edgeId) => set({ joinModeEdgeId: edgeId }),
  cancelEdgeJoinMode: () => set({ joinModeEdgeId: null }),

  // Session 135 — keyboard edge-creation mode. The `connect` action lives
  // in the document slice (edgesSlice); we dispatch through `get()` to
  // reach it without a circular slice import.
  startPendingEdge: (sourceId) => set({ pendingEdgeSourceId: sourceId }),
  cancelPendingEdge: () => set({ pendingEdgeSourceId: null }),
  completePendingEdge: (targetId) => {
    const sourceId = get().pendingEdgeSourceId;
    if (!sourceId) return null;
    set({ pendingEdgeSourceId: null });
    if (sourceId === targetId) return null; // self-loop guard
    const edge = get().connect(sourceId, targetId);
    return edge?.id ?? null;
  },
});
