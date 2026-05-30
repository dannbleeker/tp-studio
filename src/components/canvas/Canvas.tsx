import { Background, BackgroundVariant, MiniMap, type Node, ReactFlow } from '@xyflow/react';
import { useEffect } from 'react';
import { useShallow } from 'zustand/shallow';
import { defaultEntityType } from '@/domain/entityTypeMeta';
import { GRID_DOT } from '@/domain/tokens';
import { guardWriteOrToast } from '@/services/browseLock';
import { setCanvasInstance } from '@/services/canvasRef';
import { useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';
import { VerbalisationStrip } from '../inspector/VerbalisationStrip';
import { AssumptionAnchorOverlay } from './edges/AssumptionAnchorOverlay';
import { JunctorOverlay } from './edges/JunctorOverlay';
import { TPEdge } from './edges/TPEdge';
import { useArrowKeyNodeNav } from './hooks/useArrowKeyNodeNav';
import { useCanvasClickHandlers } from './hooks/useCanvasClickHandlers';
import { useCanvasContextMenuHandlers } from './hooks/useCanvasContextMenuHandlers';
import { useCanvasDragHandlers } from './hooks/useCanvasDragHandlers';
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

// Session 135 / Perf #1 + #2 — hoist props that were fresh object /
// function literals on every `CanvasInner` render. A new identity each
// render makes React Flow + MiniMap treat them as changed; module-scope
// constants are stable for the component's lifetime.
const FIT_VIEW_OPTIONS = { padding: 0.4, maxZoom: 1.2 };
const miniMapNodeColor = (n: Node): string =>
  n.type === 'tpGroup' || n.type === 'tpCollapsedGroup' ? '#a5b4fc' : '#737373';

function CanvasInner() {
  const doc = useDocumentStore((s) => currentDoc(s));
  // Action-only bundle: every field below is a store-action ref (stable
  // across renders), so this selector never re-emits and the component
  // doesn't re-render on store changes that aren't `doc`. Keep state
  // reads separate (above and below) so the contract stays explicit.
  const { selectEntities, selectEdges, addEntity, closeHistoryPanel } = useDocumentStore(
    useShallow((s) => ({
      selectEntities: s.selectEntities,
      selectEdges: s.selectEdges,
      addEntity: s.addEntity,
      closeHistoryPanel: s.closeHistoryPanel,
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
  const { onNodeClick, onEdgeClick, onPaneClick } = useCanvasClickHandlers();
  const { onNodeDrag, onNodeDragStop } = useCanvasDragHandlers(doc, nodes);
  const { onNodeContextMenu, onEdgeContextMenu, onPaneContextMenu } =
    useCanvasContextMenuHandlers();

  // Session 135 — canvas a11y slice 4. Arrow keys, when a node has
  // focus, walk to the connected neighbour in that direction.
  useArrowKeyNodeNav();

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
        // The Alt-drag-to-splice gestures (per-frame highlight + the drop
        // splice) live in `useCanvasDragHandlers` (unit-tested there).
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        // TOC-reading direct-manipulation: track hovered edge during a
        // connection drag so `onConnectEnd` can detect "released on an
        // edge body" and AND-group the new edge with the existing one.
        onEdgeMouseEnter={onEdgeMouseEnter}
        onEdgeMouseLeave={onEdgeMouseLeave}
        onNodeClick={onNodeClick}
        // Edge-join mode + the Alt-click / pane-deselect gestures live in
        // `useCanvasClickHandlers` (unit-tested there).
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onSelectionChange={({ nodes: selNodes, edges: selEdges }) => {
          // React Flow drives selection during marquee-drag, ctrl/cmd-click,
          // and shift-click multi-select. Mirror its truth into the store.
          // Edges win when both sets are non-empty (matches inspector's
          // single-kind contract). A new non-empty selection also closes
          // the H1 history panel so the inspector can take over the right
          // edge.
          //
          // Session 136 — the empty-arrays branch used to call
          // `clearSelection()`. That made the inspector close on any
          // doc edit: when the user edited an entity field, the new
          // doc reference rebuilt the `nodes` array, React Flow
          // re-keyed internally, and during that re-keying it fired
          // `onSelectionChange` with empty selNodes/selEdges before
          // settling on the new selection — which cleared the store
          // selection mid-edit. The right "deselect" gesture is
          // `onPaneClick` (handled separately above); we don't need
          // to mirror empty here too. Drop the else, keep only the
          // mirror-non-empty branches.
          //
          // **Do NOT re-add an `else { clearSelection() }` here.** The
          // regression coverage that pins this lives at
          // `tests/store/inspectorStaysOpenOnEdit.test.ts` — those
          // tests assert that every doc-mutating action (updateEntity
          // title / type / description / state / position / etc.)
          // leaves the store selection intact. The browser-level
          // round-trip through React Flow's selection state is
          // covered by the e2e suite. If a deselect path is genuinely
          // needed, add it to `onPaneClick` or to a focused gesture
          // handler, not here.
          if (selEdges.length > 0) {
            selectEdges(selEdges.map((e) => e.id));
            closeHistoryPanel();
          } else if (selNodes.length > 0) {
            selectEntities(selNodes.map((n) => n.id));
            closeHistoryPanel();
          }
        }}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
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
        fitViewOptions={FIT_VIEW_OPTIONS}
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
            nodeColor={miniMapNodeColor}
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
              // Session 138 — the chrome moved to a real header row, so the
              // strip no longer has to dodge floating toolbar buttons; it
              // sits just inside the canvas top.
              <div className="pointer-events-none absolute top-2 right-0 left-0 z-10 flex flex-col items-stretch gap-1 px-4">
                <div className="pointer-events-auto">
                  <ECReadingInstructions />
                </div>
                <div className="pointer-events-auto w-full">
                  <VerbalisationStrip />
                </div>
              </div>
            )}
            {/* Injection chip, top-right of the canvas. Session 138 — with
                the chrome in a header row it no longer shares a band with the
                toolbar buttons, so it sits just inside the canvas top. */}
            <div className="pointer-events-none absolute top-2 right-4 z-10 flex justify-end">
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
