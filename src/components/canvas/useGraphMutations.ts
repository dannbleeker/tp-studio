import { guardWriteOrToast } from '@/services/browseLock';
import { useDocumentStore } from '@/store';
import type {
  Connection,
  EdgeChange,
  FinalConnectionState,
  NodeChange,
  Edge as RFEdge,
} from '@xyflow/react';
import { useCallback, useRef } from 'react';
import { useShallow } from 'zustand/shallow';

/**
 * React Flow → store bridge for canvas mutations.
 *
 * Handles four streams:
 *   - **Delete-on-remove** for `NodeChange` / `EdgeChange` with `type ===
 *     'remove'`. React Flow emits removals from keyboard delete, marquee
 *     delete, and edge prune cascades; each goes through the same lock
 *     gate so a browse-locked doc shows the toast once per gesture.
 *   - **Connect-on-drag** for the React Flow drag-to-connect handle gesture.
 *     The alt-click connect path lives in Canvas.tsx (`onNodeClick`) — same
 *     store action, different gesture.
 *   - **Connect-on-drag-end fallback** (Session 49): React Flow's default
 *     `onConnect` only fires when the user releases on or near the target's
 *     handle dot (a tiny ~10 px target). Most users naturally drop the
 *     drag *over the target box* rather than precisely on its handle. This
 *     fallback inspects `FinalConnectionState.toNode` — set by React Flow
 *     whenever the cursor was over any node at release time — and fires
 *     the same `connect()` action with the two node IDs. Each entity has
 *     exactly one target handle per diagram type, so we don't need to
 *     pick a handle; the store action takes entity IDs and React Flow
 *     wires the edge to the right Position on render.
 *   - **Position-persist** for hand-positioned diagrams (`LAYOUT_STRATEGY`
 *     equals `'manual'`). React Flow streams `'position'` changes every
 *     frame during a drag; we forward them to `setEntityPosition`, which
 *     coalesces under `pos:<id>` so the 60fps stream collapses into a
 *     single undo entry per gesture. Auto-layout diagrams ignore the
 *     branch — their nodes are draggable client-side but the position
 *     never round-trips through state, so dagre wins on the next render.
 *
 * `guardWriteOrToast()` runs per change rather than per batch — one
 * `changes` array can carry a removal cascade plus a position update, and
 * the lock gesture is per write.
 */
export const useGraphMutations = (): {
  onConnect: (c: Connection) => void;
  onConnectEnd: (event: MouseEvent | TouchEvent, connectionState: FinalConnectionState) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onEdgeMouseEnter: (event: unknown, edge: RFEdge) => void;
  onEdgeMouseLeave: (event: unknown, edge: RFEdge) => void;
} => {
  const { connect, deleteEntity, deleteEdge, setEntityPosition, addCoCauseToEdge, showToast } =
    useDocumentStore(
      useShallow((s) => ({
        connect: s.connect,
        deleteEntity: s.deleteEntity,
        deleteEdge: s.deleteEdge,
        setEntityPosition: s.setEntityPosition,
        addCoCauseToEdge: s.addCoCauseToEdge,
        showToast: s.showToast,
      }))
    );

  // Track the most recently hovered edge so a drag-from-handle that
  // releases over an edge body can detect "released on edge X" — React
  // Flow's `FinalConnectionState` doesn't expose this on its own.
  // Updated by `onEdgeMouseEnter` / cleared by `onEdgeMouseLeave`. Read
  // inside `onConnectEnd`.
  const hoveredEdgeRef = useRef<string | null>(null);
  const onEdgeMouseEnter = useCallback((_event: unknown, edge: RFEdge) => {
    hoveredEdgeRef.current = edge.id;
  }, []);
  const onEdgeMouseLeave = useCallback((_event: unknown, _edge: RFEdge) => {
    hoveredEdgeRef.current = null;
  }, []);

  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target) return;
      if (!guardWriteOrToast()) return;
      connect(c.source, c.target);
    },
    [connect]
  );

  const onConnectEnd = useCallback(
    (_event: MouseEvent | TouchEvent, connectionState: FinalConnectionState) => {
      // Connection-drag end: three release contexts in priority order:
      //   1. Released on a handle dot                → `onConnect` already
      //      fired; nothing to do here.
      //   2. Released over a node body (Session 49)  → bridge to `connect`.
      //   3. Released over an edge body (TOC-reading)→ add co-cause via
      //      AND junctor on that edge's target.
      //   4. Released in empty space                 → drop the connection.
      if (connectionState.toHandle !== null) return;
      if (!connectionState.fromNode) return;
      const sourceId = connectionState.fromNode.id;

      if (connectionState.toNode) {
        const targetId = connectionState.toNode.id;
        if (sourceId === targetId) return;
        if (!guardWriteOrToast()) return;
        connect(sourceId, targetId);
        hoveredEdgeRef.current = null;
        return;
      }

      // No `toNode` — but the cursor MAY have been over an edge. Consume
      // the tracked-hovered-edge ref. We clear the ref unconditionally so
      // a stale hover from an earlier gesture doesn't trigger on the next
      // unrelated drag.
      const hoveredEdgeId = hoveredEdgeRef.current;
      hoveredEdgeRef.current = null;
      if (!hoveredEdgeId) return;
      if (!guardWriteOrToast()) return;
      const result = addCoCauseToEdge(hoveredEdgeId, sourceId);
      if (result) {
        showToast('success', 'Added as a co-cause (AND-grouped).');
      } else {
        showToast('info', 'Cannot AND here — same source/target, or duplicate edge.');
      }
    },
    [connect, addCoCauseToEdge, showToast]
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const change of changes) {
        if (change.type === 'remove') {
          if (!guardWriteOrToast()) continue;
          deleteEntity(change.id);
          continue;
        }
        if (
          change.type === 'position' &&
          change.position &&
          // Only persist when the drag has settled. React Flow tags each
          // frame during a live drag with `dragging: true` and the final
          // settle event with `dragging: false`. Streaming every frame
          // would still be correct thanks to `setEntityPosition`'s coalesce
          // key, but we avoid the per-frame store churn entirely.
          change.dragging === false
        ) {
          // LA5: persist the position on EVERY diagram type, not just
          // manual-layout ones. On auto-layout diagrams, the persisted
          // position pins the entity — dagre routes around it on the
          // next layout pass. The original `strategy === 'manual'` gate
          // is gone; the cache-key change in `useGraphPositions`
          // (`pinnedKey`) re-runs layout when a new pin lands.
          if (!guardWriteOrToast()) continue;
          setEntityPosition(change.id, change.position);
        }
      }
    },
    [deleteEntity, setEntityPosition]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      for (const change of changes) {
        if (change.type === 'remove') {
          if (!guardWriteOrToast()) continue;
          deleteEdge(change.id);
        }
      }
    },
    [deleteEdge]
  );

  return {
    onConnect,
    onConnectEnd,
    onNodesChange,
    onEdgesChange,
    onEdgeMouseEnter,
    onEdgeMouseLeave,
  };
};
