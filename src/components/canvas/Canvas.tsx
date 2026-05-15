import { findSpliceTargetEdge } from '@/domain/dragSplice';
import { defaultEntityType } from '@/domain/entityTypeMeta';
import { GRID_DOT } from '@/domain/tokens';
import { guardWriteOrToast } from '@/services/browseLock';
import { setCanvasInstance } from '@/services/canvasRef';
import { useDocumentStore } from '@/store';
import { Background, BackgroundVariant, Controls, MiniMap, ReactFlow } from '@xyflow/react';
import { useEffect } from 'react';
import { useShallow } from 'zustand/shallow';
import { VerbalisationStrip } from '../inspector/VerbalisationStrip';
import { Breadcrumb } from './Breadcrumb';
import { CreationWizardPanel } from './CreationWizardPanel';
import { ECInjectionChip } from './ECInjectionChip';
import { ECReadingInstructions } from './ECReadingInstructions';
import { EmptyHint } from './EmptyHint';
import { FirstEntityTip } from './FirstEntityTip';
import { JunctorOverlay } from './JunctorOverlay';
import { StatusStrip } from './StatusStrip';
import { TPCollapsedGroupNode } from './TPCollapsedGroupNode';
import { TPEdge } from './TPEdge';
import { TPGroupNode } from './TPGroupNode';
import { TPNode } from './TPNode';
import { ZoomPercent } from './ZoomPercent';
import { useGraphMutations } from './useGraphMutations';
import { useGraphView } from './useGraphView';
import { useSearchDimming } from './useSearchDimming';

const nodeTypes = {
  tp: TPNode,
  tpGroup: TPGroupNode,
  tpCollapsedGroup: TPCollapsedGroupNode,
};
const edgeTypes = { tp: TPEdge };

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
    showToast,
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
      showToast: s.showToast,
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

  return (
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
          const entityPositions: Record<string, { x: number; y: number }> = {};
          for (const n of nodes) {
            const cx = n.position.x + (n.measured?.width ?? 0) / 2;
            const cy = n.position.y + (n.measured?.height ?? 0) / 2;
            entityPositions[n.id] = { x: cx, y: cy };
          }
          // Use the dragged node's centre (its new dropped position) as
          // the hit-test probe. Tolerance is roughly half a standard
          // node width — generous enough to forgive aim, tight enough
          // to avoid accidental splices on dense graphs.
          const dropX = draggedNode.position.x + (draggedNode.measured?.width ?? 200) / 2;
          const dropY = draggedNode.position.y + (draggedNode.measured?.height ?? 60) / 2;
          const hit = findSpliceTargetEdge({
            point: { x: dropX, y: dropY },
            draggedEntityId: draggedNode.id,
            edges: Object.values(doc.edges),
            entityPositions,
            tolerance: 40,
          });
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
        onPaneClick={() => clearSelection()}
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
        {/* Session 87 UX fix #2 — Controls moved bottom-LEFT to sit
            next to the MiniMap. Previously bottom-center collided
            with the toast layer (`Toaster.tsx` is `bottom-6 left-1/2`)
            and split navigation chrome across two corners of the
            canvas. Dark-mode glyph color bumped to neutral-200 —
            React Flow's built-in dark adaptation only colors the
            chrome, not the icons themselves. */}
        <Controls
          position="bottom-left"
          showInteractive={false}
          className="!rounded-lg !border !border-neutral-200 !bg-white !text-neutral-700 !shadow-sm dark:!border-neutral-800 dark:!bg-neutral-900 dark:!text-neutral-200"
        />
        {showMinimap && (
          <MiniMap
            // Bottom-LEFT (now sitting above the Controls, per Session
            // 87 UX fix #2). The Inspector occupies the right edge
            // whenever the user has a selection; keeping all
            // navigation chrome on the left edge keeps the thumbnail
            // and the controls reachable in the same hand motion.
            position="bottom-left"
            pannable
            zoomable
            ariaLabel="Diagram minimap"
            // Hidden on phone-narrow viewports; the controls bar and zoom pct
            // are enough for navigation when there's no room for a thumbnail.
            className="!hidden sm:!block !rounded-lg !border !border-neutral-200 !bg-white/90 !shadow-sm dark:!border-neutral-800 dark:!bg-neutral-900/90"
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
        <ZoomPercent />
        <JunctorOverlay />
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
