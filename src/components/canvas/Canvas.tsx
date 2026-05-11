import { defaultEntityType } from '@/domain/entityTypeMeta';
import { GRID_DOT } from '@/domain/tokens';
import { setCanvasInstance } from '@/services/canvasRef';
import { useDocumentStore } from '@/store';
import {
  Background,
  BackgroundVariant,
  type Connection,
  Controls,
  type EdgeChange,
  type NodeChange,
  ReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import { useCallback, useEffect } from 'react';
import { useShallow } from 'zustand/shallow';
import { TPEdge } from './TPEdge';
import { TPNode } from './TPNode';
import { useGraphView } from './useGraphView';

const nodeTypes = { tp: TPNode };
const edgeTypes = { tp: TPEdge };

function CanvasInner() {
  const doc = useDocumentStore((s) => s.doc);
  const { connect, select, deleteEntity, deleteEdge, addEntity, openContextMenu } =
    useDocumentStore(
      useShallow((s) => ({
        connect: s.connect,
        select: s.select,
        deleteEntity: s.deleteEntity,
        deleteEdge: s.deleteEdge,
        addEntity: s.addEntity,
        openContextMenu: s.openContextMenu,
      }))
    );

  const { nodes, edges } = useGraphView(doc);

  useEffect(() => {
    return () => setCanvasInstance(null);
  }, []);

  const onConnect = useCallback(
    (c: Connection) => {
      if (c.source && c.target) connect(c.source, c.target);
    },
    [connect]
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const change of changes) {
        if (change.type === 'remove') deleteEntity(change.id);
      }
    },
    [deleteEntity]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      for (const change of changes) {
        if (change.type === 'remove') deleteEdge(change.id);
      }
    },
    [deleteEdge]
  );

  const isEmpty = nodes.length === 0;

  return (
    <div
      className="h-full w-full"
      onDoubleClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest('.react-flow__node') || target.closest('.react-flow__edge')) {
          return;
        }
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
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_e, n) => select({ kind: 'entity', id: n.id })}
        onEdgeClick={(_e, ed) => select({ kind: 'edge', id: ed.id })}
        onPaneClick={() => select({ kind: 'none' })}
        onNodeContextMenu={(e, n) => {
          e.preventDefault();
          select({ kind: 'entity', id: n.id });
          openContextMenu({ kind: 'entity', id: n.id }, e.clientX, e.clientY);
        }}
        onEdgeContextMenu={(e, ed) => {
          e.preventDefault();
          select({ kind: 'edge', id: ed.id });
          openContextMenu({ kind: 'edge', id: ed.id }, e.clientX, e.clientY);
        }}
        onPaneContextMenu={(e) => {
          e.preventDefault();
          openContextMenu({ kind: 'pane' }, e.clientX, e.clientY);
        }}
        multiSelectionKeyCode="Shift"
        nodesDraggable={false}
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
      </ReactFlow>
      {isEmpty && <EmptyHint />}
    </div>
  );
}

function EmptyHint() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="rounded-xl border border-neutral-200 bg-white/80 px-6 py-5 text-center shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/80">
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Empty diagram</p>
        <p className="mt-1 text-ui text-neutral-500 dark:text-neutral-400">
          Double-click anywhere to add your first entity.
        </p>
      </div>
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
