import { defaultEntityType } from '@/domain/entityTypeMeta';
import { GRID_DOT } from '@/domain/tokens';
import { guardWriteOrToast } from '@/services/browseLock';
import { setCanvasInstance } from '@/services/canvasRef';
import { useDocumentStore } from '@/store';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import { useEffect } from 'react';
import { useShallow } from 'zustand/shallow';
import { Breadcrumb } from './Breadcrumb';
import { EmptyHint } from './EmptyHint';
import { FirstEntityTip } from './FirstEntityTip';
import { JunctorOverlay } from './JunctorOverlay';
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
        selectionOnDrag
        panOnDrag={[1, 2]}
        nodesDraggable={false}
        nodesConnectable={!locked}
        zoomOnDoubleClick={false}
        proOptions={{ hideAttribution: true }}
        fitView
        fitViewOptions={{ padding: 0.4, maxZoom: 1.2 }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color={GRID_DOT} />
        <Controls
          position="bottom-center"
          showInteractive={false}
          className="!rounded-lg !border !border-neutral-200 !bg-white !shadow-sm dark:!border-neutral-800 dark:!bg-neutral-900"
        />
        {showMinimap && (
          <MiniMap
            // Bottom-LEFT: the right edge is occupied by the Inspector whenever
            // a user has a selection. Bottom-left keeps the thumbnail visible
            // through every interaction.
            position="bottom-left"
            pannable
            zoomable
            ariaLabel="Diagram minimap"
            // Hidden on phone-narrow viewports; the controls bar and zoom pct
            // are enough for navigation when there's no room for a thumbnail.
            className="!hidden sm:!block !rounded-lg !border !border-neutral-200 !bg-white/90 !shadow-sm dark:!border-neutral-800 dark:!bg-neutral-900/90"
            maskColor="rgba(99, 102, 241, 0.08)"
            nodeColor={(n) => {
              if (n.type === 'tpGroup' || n.type === 'tpCollapsedGroup') return '#a5b4fc';
              return '#737373';
            }}
          />
        )}
        <ZoomPercent />
        <JunctorOverlay />
      </ReactFlow>
      <Breadcrumb />
      {isEmpty && <EmptyHint />}
      {!isEmpty && <FirstEntityTip />}
    </div>
  );
}

export function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
