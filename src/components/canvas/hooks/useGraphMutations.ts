import type {
  Connection,
  EdgeChange,
  FinalConnectionState,
  NodeChange,
  OnConnectStartParams,
  Edge as RFEdge,
} from '@xyflow/react';
import { useCallback, useRef } from 'react';
import { useShallow } from 'zustand/shallow';
import { hasEdge } from '@/domain/graph';
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
  onConnectStart: (event: MouseEvent | TouchEvent, params: OnConnectStartParams) => void;
  onConnectEnd: (event: MouseEvent | TouchEvent, connectionState: FinalConnectionState) => void;
  onReconnect: (oldEdge: RFEdge, connection: Connection) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onEdgeMouseEnter: (event: unknown, edge: RFEdge) => void;
  onEdgeMouseLeave: (event: unknown, edge: RFEdge) => void;
} => {
  const {
    connect,
    reconnectEdge,
    deleteEntity,
    deleteEdge,
    setEntityPosition,
    addCoCauseToEdge,
    showToast,
  } = useDocumentStore(
    useShallow((s) => ({
      connect: s.connect,
      reconnectEdge: s.reconnectEdge,
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
    const s = useDocumentStore.getState();
    // Goal #3 — mark this edge hovered so TPEdge can show the select-hover
    // cue (makes the otherwise-invisible 56px hit zone discoverable). Set
    // unconditionally; the component suppresses the cue while a connection
    // drag is in flight (the drop-target glow takes over then).
    s.setHoveredEdge(edge.id);
    // Goal #2 — while a connection drag is in progress, glow this edge as the
    // "drop here to AND" target. Read the flag imperatively (no subscription);
    // the setter no-ops if unchanged so re-hovering the same edge is free.
    if (s.connectingFromId) s.setConnectionDropEdge(edge.id);
  }, []);
  const onEdgeMouseLeave = useCallback((_event: unknown, _edge: RFEdge) => {
    hoveredEdgeRef.current = null;
    const s = useDocumentStore.getState();
    s.setHoveredEdge(null);
    s.setConnectionDropEdge(null);
  }, []);

  // Goal #2 — a connection drag started; remember the source so nodes / edges
  // / junctors can light up as drop targets while the drag is in flight.
  const onConnectStart = useCallback(
    (_event: MouseEvent | TouchEvent, params: OnConnectStartParams) => {
      useDocumentStore.getState().setConnectingFrom(params.nodeId ?? null);
    },
    []
  );

  // Run `connect()` and, when it refuses, say WHY instead of failing silently.
  // `connect()` returns null on a self-loop, a missing entity, or a duplicate.
  // A self-loop is almost always an accidental release back on the start node,
  // so swallow it quietly (no toast noise). Otherwise, only when it's a CONFIRMED
  // duplicate do we explain it — the rest (e.g. a drop onto a non-entity node)
  // stays quiet rather than guessing a wrong reason. This is the fix for Dann's
  // "I'm not able to add a new edge from #2 to #6 — why?": the edge silently
  // didn't appear because one already existed and nothing said so.
  const connectOrExplain = useCallback(
    (sourceId: string, targetId: string) => {
      if (sourceId === targetId) return;
      if (connect(sourceId, targetId) !== null) return;
      if (hasEdge(useDocumentStore.getState().doc, sourceId, targetId)) {
        showToast('info', 'Those two are already linked in that direction.');
      }
    },
    [connect, showToast]
  );

  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target) return;
      if (!guardWriteOrToast()) return;
      connectOrExplain(c.source, c.target);
    },
    [connectOrExplain]
  );

  // Re-target an existing edge: the user grabbed one endpoint and dropped it on
  // a different entity. React Flow fires this only when released on a valid
  // node/handle — a drop into empty space fires `onReconnectEnd` instead, and
  // because our edges are fully controlled from the store, a no-op there (or a
  // store-rejected move below) simply re-emits the original edge → snap-back,
  // no manual revert needed.
  const onReconnect = useCallback(
    (oldEdge: RFEdge, c: Connection) => {
      if (!c.source || !c.target) return;
      // Nothing actually moved — RF can fire this on a release onto the same end.
      if (c.source === oldEdge.source && c.target === oldEdge.target) return;
      if (!guardWriteOrToast()) return;
      if (reconnectEdge(oldEdge.id, c.source, c.target) === null) {
        showToast(
          'info',
          "Can't move the connector there — it would loop a node to itself or duplicate an edge."
        );
      }
    },
    [reconnectEdge, showToast]
  );

  const onConnectEnd = useCallback(
    (_event: MouseEvent | TouchEvent, connectionState: FinalConnectionState) => {
      // Goal #2 — the drag is ending: clear the connection-drag feedback flags
      // up front (the drop resolution below is independent of them).
      const fb = useDocumentStore.getState();
      fb.setConnectingFrom(null);
      fb.setConnectionDropEdge(null);
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
        connectOrExplain(sourceId, targetId);
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
    [connectOrExplain, addCoCauseToEdge, showToast]
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
          // Position persistence is meaningful only for `manual` diagrams
          // (Evaporating Cloud), where `useGraphPositions` reads
          // `entity.position` directly. On `auto` diagrams dagre is
          // authoritative (Goal #4) and any stored position is ignored.
          // This branch is currently unreachable anyway — node dragging is
          // disabled (`Canvas.tsx` `nodesDraggable={false}`) — kept for
          // if/when EC drag-to-reposition is re-enabled.
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
    onConnectStart,
    onConnectEnd,
    onReconnect,
    onNodesChange,
    onEdgesChange,
    onEdgeMouseEnter,
    onEdgeMouseLeave,
  };
};
