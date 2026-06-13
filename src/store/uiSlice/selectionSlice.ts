import type { StateCreator } from 'zustand';
import type { EdgeId, EntityId, GroupId } from '@/domain/types';
import { currentDoc } from '../selectors';
import type { RootStore } from '../types';
import type { Selection } from './types';

/**
 * The canvas's current *interaction mode* — the two mutually-exclusive
 * "the next click means something special" gestures, folded into one
 * discriminated union (Session 138) so they can't both be half-set and a
 * reader can `switch` on `kind`.
 *
 *   - `idle`         — normal canvas; clicks select.
 *   - `edge-join`    — Session 133. The next edge click AND-groups the held
 *                      `edgeId` with the clicked edge (entered via the
 *                      selection-toolbar "AND-join with another edge…" verb).
 *   - `pending-edge` — Session 135 (a11y slice 5). Keyboard edge creation: a
 *                      source entity is chosen and the next entity click /
 *                      `completePendingEdge` makes the edge.
 *
 * Deliberately NOT folded in: `hoistedGroupId` (an orthogonal *view* filter —
 * you can be hoisted AND mid-gesture) and `spliceTargetEdgeId` (per-frame
 * drag highlight, not a mode).
 */
export type CanvasMode =
  | { kind: 'idle' }
  | { kind: 'edge-join'; edgeId: EdgeId }
  | { kind: 'pending-edge'; sourceId: EntityId };

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

  /** Goal #2 — transient connection-drag feedback. `connectingFromId` is the
   *  source entity id while a connection drag is in progress (set on
   *  `onConnectStart`, cleared on `onConnectEnd`); `connectionDropEdgeId` is
   *  the edge currently hovered DURING such a drag, so `TPEdge` can glow
   *  "release to AND here". Both transient, not persisted. */
  connectingFromId: string | null;
  connectionDropEdgeId: string | null;

  /** Goal #3 — the edge currently hovered (no drag in flight), backing the
   *  select-hover highlight so the 56px hit zone is discoverable. `TPEdge`
   *  reads `hoveredEdgeId === id`. Transient; the setter no-ops on an
   *  unchanged value so moving within one edge doesn't fan re-renders. */
  hoveredEdgeId: string | null;

  /** Hover-fan (Session 185) — the TARGET id of the currently-hovered edge, set
   *  alongside `hoveredEdgeId`. `TPEdge` reads `hoveredEdgeTargetId === target` to
   *  know its convergence group is hovered and spread the fan. Null when nothing
   *  is hovered. */
  hoveredEdgeTargetId: string | null;

  /** Session 138 — the canvas interaction mode (`idle` / `edge-join` /
   *  `pending-edge`), folding the former `joinModeEdgeId` +
   *  `pendingEdgeSourceId` nullable flags into one discriminated union so
   *  the two gestures are mutually exclusive by construction. The
   *  start/cancel/complete actions below drive it; the Esc cascade clears
   *  the active mode ahead of hoist + selection. (Hoist + splice-target
   *  stay separate — see `CanvasMode`.) */
  canvasMode: CanvasMode;

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

  /** Goal #2 — connection-drag feedback setters. Both no-op when the value
   *  is already what's requested, so the per-frame hover during a drag
   *  doesn't fan re-renders unless the target changed. */
  setConnectingFrom: (id: string | null) => void;
  setConnectionDropEdge: (edgeId: string | null) => void;

  /** Goal #3 — set/clear the hovered edge for the select-hover highlight.
   *  No-op when unchanged (same per-frame-safety rationale as the two
   *  connection-drag setters above). */
  setHoveredEdge: (edgeId: string | null, targetId?: string | null) => void;

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
  | 'connectingFromId'
  | 'connectionDropEdgeId'
  | 'hoveredEdgeId'
  | 'hoveredEdgeTargetId'
  | 'canvasMode';

export const selectionDefaults = (): Pick<SelectionSlice, SelectionDataKeys> => ({
  selection: { kind: 'none' },
  editingEntityId: null,
  hoistedGroupId: null,
  spliceTargetEdgeId: null,
  connectingFromId: null,
  connectionDropEdgeId: null,
  hoveredEdgeId: null,
  hoveredEdgeTargetId: null,
  canvasMode: { kind: 'idle' },
});

const toggleId = (ids: string[], id: string): string[] =>
  ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];

export const createSelectionSlice: StateCreator<RootStore, [], [], SelectionSlice> = (
  set,
  get
) => ({
  // Initial data fields come from the single source of truth, so this slice
  // and `resetStoreForTest` (which spreads `selectionDefaults()`) can't drift.
  ...selectionDefaults(),

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

  setConnectingFrom: (id) => {
    if (get().connectingFromId === id) return;
    set({ connectingFromId: id });
  },
  setConnectionDropEdge: (edgeId) => {
    if (get().connectionDropEdgeId === edgeId) return;
    set({ connectionDropEdgeId: edgeId });
  },
  setHoveredEdge: (edgeId, targetId = null) => {
    // Same bail-early rationale as the connection-drag setters: edge
    // mousemove can refire for the same id, and every visible TPEdge
    // subscribes to `hoveredEdgeId === props.id`, so an unchanged write
    // would thrash reconciliation across the whole canvas. The hovered edge's
    // target rides along for the hover-fan group check (Session 185).
    if (get().hoveredEdgeId === edgeId) return;
    set({ hoveredEdgeId: edgeId, hoveredEdgeTargetId: edgeId === null ? null : targetId });
  },

  startEdgeJoinMode: (edgeId) =>
    set({ canvasMode: { kind: 'edge-join', edgeId: edgeId as EdgeId } }),
  cancelEdgeJoinMode: () =>
    set((s) => (s.canvasMode.kind === 'edge-join' ? { canvasMode: { kind: 'idle' } } : {})),

  // Session 135 — keyboard edge-creation mode. The `connect` action lives
  // in the document slice (edgesSlice); we dispatch through `get()` to
  // reach it without a circular slice import.
  startPendingEdge: (sourceId) =>
    set({ canvasMode: { kind: 'pending-edge', sourceId: sourceId as EntityId } }),
  cancelPendingEdge: () =>
    set((s) => (s.canvasMode.kind === 'pending-edge' ? { canvasMode: { kind: 'idle' } } : {})),
  completePendingEdge: (targetId) => {
    const mode = get().canvasMode;
    if (mode.kind !== 'pending-edge') return null;
    const { sourceId } = mode;
    set({ canvasMode: { kind: 'idle' } });
    if (sourceId === targetId) return null; // self-loop guard
    const edge = get().connect(sourceId, targetId);
    return edge?.id ?? null;
  },
});
