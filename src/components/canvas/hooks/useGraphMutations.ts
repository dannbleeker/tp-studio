import type {
  Connection,
  EdgeChange,
  FinalConnectionState,
  NodeChange,
  Edge as RFEdge,
} from '@xyflow/react';
import { useCallback, useRef } from 'react';
import { useShallow } from 'zustand/shallow';
import { guardWriteOrToast } from '@/services/browseLock';
import { getCanvasInstance, getHoveredJunctor, setHoveredJunctor } from '@/services/canvasRef';
import { useDocumentStore } from '@/store';

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
      // Connection-drag end: priority order
      //   1. Released on a handle dot                → `onConnect` already
      //      fired; nothing to do here.
      //   2. Released over a node body (Session 49)  → bridge to `connect`.
      //   3. Released over a JUNCTOR circle (Session 136) → join the
      //      group via `addCoCauseToEdge` on any of its member edges.
      //      Picked up before the edge-body fallback so a hover that
      //      sat on a junctor and an underlying edge body resolves to
      //      the junctor (more specific gesture).
      //   4. Released over an edge body (TOC-reading)→ add co-cause via
      //      AND junctor on that edge's target.
      //   5. Released in empty space                 → drop the connection.
      if (connectionState.toHandle !== null) return;
      if (!connectionState.fromNode) return;
      const sourceId = connectionState.fromNode.id;

      if (connectionState.toNode) {
        const targetId = connectionState.toNode.id;
        if (sourceId === targetId) {
          hoveredEdgeRef.current = null;
          setHoveredJunctor(null);
          return;
        }
        if (!guardWriteOrToast()) return;
        connect(sourceId, targetId);
        hoveredEdgeRef.current = null;
        setHoveredJunctor(null);
        return;
      }

      // No `toNode`. Check if the cursor was over a junctor circle.
      // `JunctorOverlay`'s circles set `setHoveredJunctor({...})` on
      // mouseEnter; we consume + clear it here so a stale hover from
      // an earlier drag doesn't trigger on the next.
      const hoveredJunctor = getHoveredJunctor();
      setHoveredJunctor(null);
      if (hoveredJunctor) {
        if (!guardWriteOrToast()) return;
        // Map the overlay's display label ('AND' / 'OR' / 'XOR') to the
        // store's lowercase kind enum + the matching `*GroupId` field
        // on `TPEdgeData`. The three are isomorphic; keeping the
        // mapping explicit lets the type checker catch any future
        // junctor-kind addition.
        const kindLower: 'and' | 'or' | 'xor' =
          hoveredJunctor.kind === 'AND' ? 'and' : hoveredJunctor.kind === 'OR' ? 'or' : 'xor';
        const groupIdField: 'andGroupId' | 'orGroupId' | 'xorGroupId' =
          kindLower === 'and' ? 'andGroupId' : kindLower === 'or' ? 'orGroupId' : 'xorGroupId';
        // Find any edge in this junctor's group so `addCoCauseToEdge`
        // has a host edge to attach to. Group membership is by the
        // matching `*GroupId` field on the edge; picking any member is
        // fine since they all share the same target.
        const flow = getCanvasInstance();
        const rfEdges = flow?.getEdges() ?? [];
        const memberEdge = rfEdges.find((e) => e.data?.[groupIdField] === hoveredJunctor.groupId);
        if (!memberEdge) {
          // Group disappeared mid-drag (rare; e.g. user undid an edge
          // while dragging). Fail open with an info toast.
          showToast('info', `${hoveredJunctor.kind} group no longer exists — try again.`);
          hoveredEdgeRef.current = null;
          return;
        }
        const result = addCoCauseToEdge(memberEdge.id, sourceId, kindLower);
        if (result) {
          showToast('success', `Added as a co-cause (${hoveredJunctor.kind}-grouped).`);
        } else {
          showToast(
            'info',
            `Cannot ${hoveredJunctor.kind} here — same source/target, or duplicate edge.`
          );
        }
        hoveredEdgeRef.current = null;
        return;
      }

      // No `toNode` and no junctor. Check the hovered-edge ref next.
      // The edge-body drop is always AND (the canonical "add a
      // sufficient co-cause" gesture from the book); OR / XOR only fire
      // when the user explicitly drops on an existing junctor circle.
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
