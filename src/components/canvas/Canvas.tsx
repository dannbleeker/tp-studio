import { Background, BackgroundVariant, MiniMap, ReactFlow } from '@xyflow/react';
import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/shallow';
import { findSpliceTargetEdge } from '@/domain/dragSplice';
import { defaultEntityType } from '@/domain/entityTypeMeta';
import { edgesArray } from '@/domain/graph';
import { GRID_DOT } from '@/domain/tokens';
import { guardWriteOrToast } from '@/services/browseLock';
import { setCanvasInstance } from '@/services/canvasRef';
import { useDocumentStore } from '@/store';
import { VerbalisationStrip } from '../inspector/VerbalisationStrip';
import { AssumptionAnchorOverlay } from './edges/AssumptionAnchorOverlay';
import { JunctorOverlay } from './edges/JunctorOverlay';
import { TPEdge } from './edges/TPEdge';
import { useGraphMutations } from './hooks/useGraphMutations';
import { useGraphView } from './hooks/useGraphView';
import { useSearchDimming } from './hooks/useSearchDimming';
import { TPCollapsedGroupNode } from './nodes/TPCollapsedGroupNode';
import { TPGroupNode } from './nodes/TPGroupNode';
import { TPNode } from './nodes/TPNode';
import { Breadcrumb } from './overlays/Breadcrumb';
import { CanvasNav } from './overlays/CanvasNav';
import { ECInjectionChip } from './overlays/ECInjectionChip';
import { ECReadingInstructions } from './overlays/ECReadingInstructions';
import { EmptyHint } from './overlays/EmptyHint';
import { FirstEntityTip } from './overlays/FirstEntityTip';
import { StatusStrip } from './overlays/StatusStrip';
import { CreationWizardPanel } from './wizards/CreationWizardPanel';

const nodeTypes = {
  tp: TPNode,
  tpGroup: TPGroupNode,
  tpCollapsedGroup: TPCollapsedGroupNode,
};
const edgeTypes = { tp: TPEdge };

/**
 * Session 135 / Perf #6 — populate a centroid buffer in-place.
 *
 * Both drag handlers need an entity-id → centre-of-node map for the
 * splice-target hit-test. Allocating a fresh `Record<>` per
 * `onNodeDrag` call (which fires per pointer frame during a drag)
 * generated ~6k small-object allocations per second on a 100-entity
 * graph.
 *
 * This helper mutates a caller-owned `buf` object: clears the prior
 * keys (only those that aren't being re-set this call), then writes
 * one entry per node. The buffer lives in a `useRef` inside
 * `CanvasInner` so React doesn't track it and the same shape is
 * reused frame-to-frame.
 *
 * Returns the same `buf` reference for chained calls (e.g.
 * `findSpliceTargetEdge({ entityPositions: populateCentroidsInto(...) })`).
 */
type Centroid = { x: number; y: number };
type CentroidBuf = Record<string, Centroid>;
type CanvasNodeSlim = {
  id: string;
  position: { x: number; y: number };
  measured?: { width?: number; height?: number };
};

const populateCentroidsInto = (buf: CentroidBuf, nodes: readonly CanvasNodeSlim[]): CentroidBuf => {
  // Build a Set of the ids we'll write this call so we can drop stale
  // entries from a previous (possibly larger) drag without
  // re-allocating the whole object. Keeping the same buffer shape
  // helps V8's hidden-class tracking.
  const ids = new Set<string>();
  for (const n of nodes) ids.add(n.id);
  for (const key of Object.keys(buf)) {
    if (!ids.has(key)) delete buf[key];
  }
  for (const n of nodes) {
    const cx = n.position.x + (n.measured?.width ?? 0) / 2;
    const cy = n.position.y + (n.measured?.height ?? 0) / 2;
    const existing = buf[n.id];
    if (existing) {
      existing.x = cx;
      existing.y = cy;
    } else {
      buf[n.id] = { x: cx, y: cy };
    }
  }
  return buf;
};

function CanvasInner() {
  const doc = useDocumentStore((s) => s.doc);
  // Action-only bundle: every field below is a store-action ref (stable
  // across renders), so this selector never re-emits and the component
  // doesn't re-render on store changes that aren't `doc`. Keep state
  // reads separate (above and below) so the contract stays explicit.
  const {
    connect,
    clearSelection,
    selectEntity,
    selectEdge,
    selectEntities,
    selectEdges,
    addEntity,
    openContextMenu,
    closeHistoryPanel,
    spliceEntityIntoEdge,
    setSpliceTargetEdge,
    showToast,
    groupAsAnd,
    cancelEdgeJoinMode,
  } = useDocumentStore(
    useShallow((s) => ({
      connect: s.connect,
      clearSelection: s.clearSelection,
      selectEntity: s.selectEntity,
      selectEdge: s.selectEdge,
      selectEntities: s.selectEntities,
      selectEdges: s.selectEdges,
      addEntity: s.addEntity,
      openContextMenu: s.openContextMenu,
      closeHistoryPanel: s.closeHistoryPanel,
      spliceEntityIntoEdge: s.spliceEntityIntoEdge,
      setSpliceTargetEdge: s.setSpliceTargetEdge,
      showToast: s.showToast,
      groupAsAnd: s.groupAsAnd,
      cancelEdgeJoinMode: s.cancelEdgeJoinMode,
    }))
  );

  const { nodes: rawNodes, edges: rawEdges } = useGraphView(doc);
  const { nodes, edges } = useSearchDimming(doc, rawNodes, rawEdges);
  const {
    onConnect,
    onConnectEnd,
    onNodesChange,
    onEdgesChange,
    onEdgeMouseEnter,
    onEdgeMouseLeave,
  } = useGraphMutations();

  useEffect(() => {
    return () => setCanvasInstance(null);
  }, []);

  // Session 135 / Perf #6 — reuse a single object literal across
  // `onNodeDrag` / `onNodeDragStop` invocations rather than allocating
  // a fresh `Record<string, {x, y}>` per pointer frame. During a 60fps
  // drag on a 100-entity graph the prior code generated ~6,000
  // small-object allocations per second; the ref-held buffer is
  // populated in-place (`for (const n of nodes) { buf[n.id] = ... }`)
  // and re-cleared between drag sessions in `onNodeDragStart`.
  //
  // `findSpliceTargetEdge` only reads `entityPositions`, so giving it
  // the shared buffer is safe. We never hold a reference to the
  // buffer beyond the synchronous handler, so the mutation can't
  // surprise an async consumer.
  const entityCentroidsRef = useRef<Record<string, { x: number; y: number }>>({});

  const isEmpty = nodes.length === 0;
  const locked = useDocumentStore((s) => s.browseLocked);
  const showMinimap = useDocumentStore((s) => s.showMinimap);
  // Session 88 (V2) — combined EC chrome wrapper. Session 89 visual
  // review found V2 had added a literal "EC CHROME" label row above
  // the two inner strips, *increasing* vertical chrome rather than
  // reducing it. Cleanup: the outer label row is gone; the chrome flag
  // simply gates whether ECReadingInstructions + VerbalisationStrip
  // render at all on EC docs. Re-show via the palette command "Show
  // EC reading guide" (or the inverse "Hide EC reading guide" when
  // currently shown). Default is `true` (hidden) so first-load is the
  // cleanest possible canvas.
  const ecChromeCollapsed = useDocumentStore((s) => s.ecChromeCollapsed);
  // Session 135 / spec gap #9 Phase 1B — presentation mode hides
  // the zoom-controls chip so the canvas reads as a clean read-only
  // surface. Other CanvasNav-adjacent overlays (junctors, assumption
  // anchors) stay because they're diagram structure, not chrome.
  const isPresentation = useDocumentStore((s) => s.appMode === 'presentation');

  // React Flow canvas wrapper: the double-click is a workspace gesture ("create
  // entity on empty canvas"). The canvas itself isn't a button or other interactive
  // widget; React Flow owns all keyboard navigation for entities/edges below this
  // layer. Equivalent keyboard path: command-palette "Add entity" or the Tab
  // shortcut documented in the keyboard help.
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: see comment above the return.
    <div
      className="h-full w-full"
      onDoubleClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest('.react-flow__node') || target.closest('.react-flow__edge')) {
          return;
        }
        if (!guardWriteOrToast()) return;
        addEntity({ type: defaultEntityType(doc.diagramType), startEditing: true });
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={(instance) => setCanvasInstance(instance)}
        onConnect={onConnect}
        // Session 49 fallback: when the user drags a connection and
        // releases over the *body* of a target node (not its handle dot),
        // React Flow's `onConnect` doesn't fire — but `onConnectEnd`
        // does, with `toNode` set to the hovered node. The hook bridges
        // that to the same `connect()` action so dragging-over-the-box
        // works as the user expects.
        onConnectEnd={onConnectEnd}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        // Session 101 — drag-splice visual feedback. Per-frame during
        // an Alt-modified node drag, run the same `findSpliceTargetEdge`
        // hit-test that `onNodeDragStop` uses and update the store's
        // `spliceTargetEdgeId`. `TPEdge` reads this and renders an
        // indigo glow on the target edge so the user can see what's
        // about to happen before they release.
        //
        // The hit-test is O(visible edges) per frame; cheap given
        // typical diagram sizes (<100 edges). The slice action bails
        // when the target hasn't changed so we don't re-render every
        // edge on every mousemove.
        //
        // Clears the target on any non-Alt drag — switching modifier
        // mid-drag (Alt down → Alt up) immediately removes the hint.
        onNodeDrag={(e, draggedNode) => {
          if (!e.altKey) {
            setSpliceTargetEdge(null);
            return;
          }
          const entityPositions = populateCentroidsInto(entityCentroidsRef.current, nodes);
          const probeX = draggedNode.position.x + (draggedNode.measured?.width ?? 200) / 2;
          const probeY = draggedNode.position.y + (draggedNode.measured?.height ?? 60) / 2;
          const hit = findSpliceTargetEdge({
            point: { x: probeX, y: probeY },
            draggedEntityId: draggedNode.id,
            edges: edgesArray(doc),
            entityPositions,
            tolerance: 40,
          });
          setSpliceTargetEdge(hit?.edgeId ?? null);
        }}
        onNodeDragStop={(e, draggedNode) => {
          // Session 83 — Alt+drag-to-splice. With the Alt modifier held
          // on drop, check whether the dragged entity landed close to
          // the centerline of an existing edge; if so, splice the
          // entity into that edge (drops the entity's prior connections
          // and rewires through it). Without Alt, this is the normal
          // drag-to-pin gesture and we leave React Flow's onNodesChange
          // to handle the position persist.
          if (!e.altKey) return;
          if (!guardWriteOrToast()) return;
          const dragged = doc.entities[draggedNode.id];
          if (!dragged) return;
          const entityPositions = populateCentroidsInto(entityCentroidsRef.current, nodes);
          // Use the dragged node's centre (its new dropped position) as
          // the hit-test probe. Tolerance is roughly half a standard
          // node width — generous enough to forgive aim, tight enough
          // to avoid accidental splices on dense graphs.
          const dropX = draggedNode.position.x + (draggedNode.measured?.width ?? 200) / 2;
          const dropY = draggedNode.position.y + (draggedNode.measured?.height ?? 60) / 2;
          const hit = findSpliceTargetEdge({
            point: { x: dropX, y: dropY },
            draggedEntityId: draggedNode.id,
            edges: edgesArray(doc),
            entityPositions,
            tolerance: 40,
          });
          // Clear the highlight unconditionally — the gesture is over
          // whether or not it triggered a splice. (Session 101 — the
          // glow lives only during the drag itself.)
          setSpliceTargetEdge(null);
          if (!hit) return;
          const ok = spliceEntityIntoEdge(draggedNode.id, hit.edgeId);
          if (ok) {
            showToast('success', 'Entity spliced into edge.');
          } else {
            showToast('info', 'Splice rejected — entity already endpoints that edge.');
          }
        }}
        // TOC-reading direct-manipulation: track hovered edge during a
        // connection drag so `onConnectEnd` can detect "released on an
        // edge body" and AND-group the new edge with the existing one.
        onEdgeMouseEnter={onEdgeMouseEnter}
        onEdgeMouseLeave={onEdgeMouseLeave}
        onNodeClick={(e, n) => {
          if (e.altKey) {
            // Alt+click on an entity while another is selected creates an
            // edge from the current single selection to the clicked node.
            const cur = useDocumentStore.getState().selection;
            if (
              cur.kind === 'entities' &&
              cur.ids.length === 1 &&
              cur.ids[0] &&
              cur.ids[0] !== n.id
            ) {
              if (guardWriteOrToast()) connect(cur.ids[0], n.id);
            }
          }
          // Plain / Shift+click otherwise: let React Flow's own selection
          // model run and we'll mirror via onSelectionChange below.
        }}
        // Session 133 — edge-join mode handler. When the user has
        // entered join mode via the "AND-join with another edge…"
        // verb / palette command, the next edge click is the second
        // edge to AND-group. We intercept it here, exit join mode,
        // and attempt the group. On success the toolbar's normal
        // multi-edge verbs take over for further junctor tweaks.
        // Failure modes (same source/target, duplicate, etc.) surface
        // via the existing `groupAsAnd` reason toast.
        onEdgeClick={(e, ed) => {
          const joinSource = useDocumentStore.getState().joinModeEdgeId;
          if (!joinSource) return;
          if (joinSource === ed.id) {
            // Clicking the source edge again cancels — gives the user
            // an exit ramp that doesn't require Esc.
            cancelEdgeJoinMode();
            showToast('info', 'Join mode cancelled.');
            return;
          }
          e.stopPropagation();
          if (!guardWriteOrToast()) {
            cancelEdgeJoinMode();
            return;
          }
          const result = groupAsAnd([joinSource, ed.id]);
          cancelEdgeJoinMode();
          if (result.ok) {
            showToast('success', 'AND-joined.');
          } else {
            showToast('info', result.reason);
          }
        }}
        onPaneClick={() => {
          // Pane click also exits join mode — same cancellation
          // semantics as Esc / clicking the source edge again.
          if (useDocumentStore.getState().joinModeEdgeId) cancelEdgeJoinMode();
          clearSelection();
        }}
        onSelectionChange={({ nodes: selNodes, edges: selEdges }) => {
          // React Flow drives selection during marquee-drag, ctrl/cmd-click,
          // and shift-click multi-select. Mirror its truth into the store.
          // Edges win when both sets are non-empty (matches inspector's
          // single-kind contract). A new non-empty selection also closes
          // the H1 history panel so the inspector can take over the right
          // edge.
          if (selEdges.length > 0) {
            selectEdges(selEdges.map((e) => e.id));
            closeHistoryPanel();
          } else if (selNodes.length > 0) {
            selectEntities(selNodes.map((n) => n.id));
            closeHistoryPanel();
          } else {
            clearSelection();
          }
        }}
        onNodeContextMenu={(e, n) => {
          e.preventDefault();
          const cur = useDocumentStore.getState().selection;
          // `n.id` arrives unbranded from React Flow; the array is
          // `EntityId[]` after #5's narrow typing — `.some(eq)` sidesteps
          // the brand check since equality is string-level at runtime.
          const inCurrent =
            cur.kind === 'entities' && cur.ids.some((id) => id === n.id) && cur.ids.length > 1;
          if (!inCurrent) selectEntity(n.id);
          openContextMenu({ kind: 'entity', id: n.id }, e.clientX, e.clientY);
        }}
        onEdgeContextMenu={(e, ed) => {
          e.preventDefault();
          const cur = useDocumentStore.getState().selection;
          const inCurrent =
            cur.kind === 'edges' && cur.ids.some((id) => id === ed.id) && cur.ids.length > 1;
          if (!inCurrent) selectEdge(ed.id);
          openContextMenu({ kind: 'edge', id: ed.id }, e.clientX, e.clientY);
        }}
        onPaneContextMenu={(e) => {
          e.preventDefault();
          openContextMenu({ kind: 'pane' }, e.clientX, e.clientY);
        }}
        multiSelectionKeyCode="Shift"
        // Session 87 UX fix #6 — lock-mode left-click pans the canvas.
        // Outside lock, left-click drag stays a marquee selection
        // (`selectionOnDrag`); middle/right drag is always pan. When
        // locked, marquee selection is meaningless (the user can't
        // edit anyway) so we hand left-click to the panner instead so
        // the canvas stays navigable without reaching for a different
        // mouse button.
        selectionOnDrag={!locked}
        panOnDrag={locked ? [0, 1, 2] : [1, 2]}
        nodesDraggable={false}
        nodesConnectable={!locked}
        zoomOnDoubleClick={false}
        proOptions={{ hideAttribution: true }}
        fitView
        fitViewOptions={{ padding: 0.4, maxZoom: 1.2 }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color={GRID_DOT} />
        {/* Session 133 — the built-in `<Controls>` (zoom in / zoom
            out / fit-view buttons) used to live bottom-left. Per user
            feedback that the corner was getting crowded (MiniMap,
            Toaster spill, selection-toolbar gesture targets), those
            three actions moved into the new `<CanvasNav>` chip
            centred at bottom-centre alongside the zoom percent.
            MiniMap stays bottom-left as the only chrome in that
            corner now. */}
        {showMinimap && (
          <MiniMap
            // Bottom-LEFT, now solo in this corner (Controls moved
            // bottom-centre Session 133). The Inspector occupies the
            // right edge whenever the user has a selection, so the
            // thumbnail stays on the opposite side for spatial
            // separation.
            position="bottom-left"
            pannable
            zoomable
            ariaLabel="Diagram minimap"
            // Hidden on phone-narrow viewports; the controls bar and zoom pct
            // are enough for navigation when there's no room for a thumbnail.
            className="!hidden sm:!block !rounded-lg !border !border-neutral-200 !bg-white/90 !shadow-xs dark:!border-neutral-800 dark:!bg-neutral-900/90"
            // Session 87 UX fix #1 — the viewport rectangle was
            // effectively invisible at 8% indigo. Bump opacity so the
            // currently-visible window reads clearly on the thumbnail,
            // and add a 1.5-px indigo stroke so the rectangle has a
            // hard edge regardless of background.
            maskColor="rgba(99, 102, 241, 0.18)"
            maskStrokeColor="#6366f1"
            maskStrokeWidth={1.5}
            nodeColor={(n) => {
              if (n.type === 'tpGroup' || n.type === 'tpCollapsedGroup') return '#a5b4fc';
              return '#737373';
            }}
            // Border on each node thumbnail — without it, neutral-grey
            // nodes blend into the off-white minimap background. The
            // 1-px slate stroke gives every node a visible silhouette.
            nodeStrokeColor="#525252"
            nodeStrokeWidth={1}
          />
        )}
        {!isPresentation && <CanvasNav />}
        <JunctorOverlay />
        <AssumptionAnchorOverlay />
        {/* Session 77: EC verbalisation strip overlays the canvas top
            edge on EC docs only. Session 87: stacked under the new
            ECReadingInstructions strip (PPT comparison item #1) and
            paired with the top-right ECInjectionChip (item #7). The
            child components are themselves EC-gated, so the
            conditional in this JSX is purely for the wrapper class. */}
        {doc.diagramType === 'ec' && (
          <>
            {/* Session 89 EC chrome cleanup — the outer V2 wrapper +
                "EC CHROME" label row is gone. When the reading guide
                is shown, the two inner strips render directly (each
                with its own dismiss / collapse). When hidden (default),
                the canvas reclaims all vertical chrome — re-show via
                the palette command. Positioning rationale below kept
                from Session 87 (V10): at xs (< 640 px) the strip drops
                below the TopBar; at sm+ it sits in the top band. */}
            {!ecChromeCollapsed && (
              <div className="pointer-events-none absolute top-14 right-0 left-0 z-10 flex flex-col items-stretch gap-1 px-4 sm:top-2">
                <div className="pointer-events-auto">
                  <ECReadingInstructions />
                </div>
                <div className="pointer-events-auto w-full">
                  <VerbalisationStrip />
                </div>
              </div>
            )}
            {/* Session 89 cleanup — injection chip now anchored BELOW
                the TopBar at all viewport sizes (was sharing the
                top-right band with the TopBar buttons at sm+, which
                obscured the chip behind lock / history / help). */}
            <div className="pointer-events-none absolute top-14 right-4 z-10 flex justify-end">
              <ECInjectionChip />
            </div>
          </>
        )}
      </ReactFlow>
      <Breadcrumb />
      {isEmpty && <EmptyHint />}
      {!isEmpty && <FirstEntityTip />}
      <StatusStrip />
      {/* Session 78 — Goal Tree / EC creation wizard panel. The
          component returns null when no wizard is active, so the
          unconditional mount is safe; renders top-left over the
          canvas otherwise. */}
      <CreationWizardPanel />
    </div>
  );
}

/**
 * Session 95 — `<ReactFlowProvider>` hoisted out of `<Canvas />`
 * into `App.tsx` so the selection-anchored toolbar (and any future
 * canvas-aware overlay mounted alongside it) can read React Flow's
 * state via `useRFStore`. Canvas itself doesn't need to wrap the
 * provider anymore — the provider is the App's responsibility now.
 */
export function Canvas() {
  return <CanvasInner />;
}
