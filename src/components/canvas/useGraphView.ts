import { MarkerType, type Edge as RFEdge, type Node as RFNode } from '@xyflow/react';
import { useMemo } from 'react';
import { computeLayout } from '../../domain/layout';
import type { TPDocument } from '../../domain/types';
import { NODE_MIN_HEIGHT, NODE_WIDTH, type TPNodeData } from './TPNode';

export type GraphView = {
  nodes: RFNode<TPNodeData>[];
  edges: RFEdge[];
};

export const useGraphView = (doc: TPDocument): GraphView =>
  useMemo(() => {
    const entityList = Object.values(doc.entities);
    const edgeList = Object.values(doc.edges);

    const positions = computeLayout(
      entityList.map((e) => ({ id: e.id, width: NODE_WIDTH, height: NODE_MIN_HEIGHT })),
      edgeList.map((e) => ({ sourceId: e.sourceId, targetId: e.targetId }))
    );

    const nodes: RFNode<TPNodeData>[] = entityList.map((entity) => ({
      id: entity.id,
      type: 'tp',
      position: positions[entity.id] ?? { x: 0, y: 0 },
      data: { entity },
    }));

    const edges: RFEdge[] = edgeList.map((edge) => ({
      id: edge.id,
      source: edge.sourceId,
      target: edge.targetId,
      type: 'tp',
      data: { andGroupId: edge.andGroupId },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: edge.andGroupId ? '#8b5cf6' : '#737373',
      },
    }));

    return { nodes, edges };
  }, [doc]);
