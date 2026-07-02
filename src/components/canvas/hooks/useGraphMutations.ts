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
import { defaultEntityType } from '@/domain/entityTypeMeta';
import { hasEdge } from '@/domain/graph';
import { LAYOUT_STRATEGY } from '@/domain/layoutStrategy';
import { guardWriteOrToast } from '@/services/browseLock';
import { getCanvasInstance, getHoveredJunctor, setHoveredJunctor } from '@/services/canvasRef';
import { useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';
import { resolveConnectEndTarget } from './resolveConnectEndTarget';

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
    s.setHoveredEdge(edge.id, edge.target);
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
    (event: MouseEvent | TouchEvent, connectionState: FinalConnectionState) => {
      // Goal #2 — the drag is ending: clear the connection-drag feedback flags
      // up front (the drop resolution below is independent of them).
      const fb = useDocumentStore.getState();
      fb.setConnectingFrom(null);
      fb.setConnectionDropEdge(null);
      // Guard clauses (unchanged): a handle hit means `onConnect` already fired;
      // no `fromNode` means there's nothing to attach. Neither consumes the
      // hover channels — those are cleared only once we're past these.
      if (connectionState.toHandle !== null) return;
      if (!connectionState.fromNode) return;
      const sourceId = connectionState.fromNode.id;

      // Snapshot + clear the two hover channels. `JunctorOverlay` / `onEdgeMouse*`
      // write them during the drag; every drop branch below consumes them, so
      // clearing both up-front once is behaviour-equivalent to the old per-branch
      // clears AND keeps the decision pure. (It also drops a latent stale-ref
      // carryover the old code left when a junctor drop was Browse-Lock-blocked.)
      const hoveredJunctor = getHoveredJunctor();
      const hoveredEdgeId = hoveredEdgeRef.current;
      setHoveredJunctor(null);
      hoveredEdgeRef.current = null;

      // Decide what the release means (priority: node body → junctor → edge body
      // → empty). All the imperative precedence lives in `resolveConnectEndTarget`
      // now, unit-tested; this handler just executes the verdict.
      const target = resolveConnectEndTarget({
        sourceId,
        toNodeId: connectionState.toNode?.id ?? null,
        fromHandleType: connectionState.fromHandle?.type ?? 'source',
        hoveredJunctor,
        hoveredEdgeId,
        rfEdges: getCanvasInstance()?.getEdges() ?? [],
      });

      switch (target.kind) {
        case 'noop':
          return;
        case 'create-and-connect': {
          // Released in empty space — mint a fresh entity and wire it, turning
          // the "drag out and let go" gesture into a new connected node (the
          // dominant sketch-a-chain-outward motion) instead of a silent no-op.
          if (!guardWriteOrToast()) return;
          const st = useDocumentStore.getState();
          const doc = currentDoc(st);
          const fresh = st.addEntity({
            type: defaultEntityType(doc.diagramType),
            startEditing: true,
          });
          // Manual-layout diagrams (EC / freeform) honour `Entity.position` —
          // drop the node where the drag was released. Auto-layout diagrams let
          // dagre place it, so skip the extra history step there.
          if (LAYOUT_STRATEGY[doc.diagramType] === 'manual') {
            const inst = getCanvasInstance();
            const touch = 'clientX' in event ? null : event.changedTouches?.[0];
            const screenPoint =
              'clientX' in event
                ? { x: event.clientX, y: event.clientY }
                : touch
                  ? { x: touch.clientX, y: touch.clientY }
                  : null;
            if (inst && screenPoint) {
              st.setEntityPosition(fresh.id, inst.screenToFlowPosition(screenPoint));
            }
          }
          // Direction from the grabbed handle: a `source` handle extends
          // downstream (source → new child); a `target` handle extends upstream
          // (new parent → source), mirroring the Tab / Shift+Tab semantics.
          if (target.fromHandleType === 'source') connectOrExplain(target.sourceId, fresh.id);
          else connectOrExplain(fresh.id, target.sourceId);
          return;
        }
        case 'connect':
          if (!guardWriteOrToast()) return;
          connectOrExplain(target.sourceId, target.targetId);
          return;
        case 'junctor': {
          if (!guardWriteOrToast()) return;
          const result = addCoCauseToEdge(target.memberEdgeId, target.sourceId, target.junctorKind);
          showToast(
            result ? 'success' : 'info',
            result
              ? `Added as a co-cause (${target.label}-grouped).`
              : `Cannot ${target.label} here — same source/target, or duplicate edge.`
          );
          return;
        }
        case 'junctor-missing':
          showToast('info', `${target.label} group no longer exists — try again.`);
          return;
        case 'edge-andcause': {
          if (!guardWriteOrToast()) return;
          const result = addCoCauseToEdge(target.edgeId, target.sourceId);
          showToast(
            result ? 'success' : 'info',
            result
              ? 'Added as a co-cause (AND-grouped).'
              : 'Cannot AND here — same source/target, or duplicate edge.'
          );
          return;
        }
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
