import { MarkerType } from '@xyflow/react';
import { useMemo } from 'react';
import { NODE_MIN_HEIGHT, NODE_WIDTH } from '../../domain/constants';
import { computeLayout } from '../../domain/layout';
import { EDGE_MARKER_AND, EDGE_MARKER_DEFAULT } from '../../domain/tokens';
import type { TPDocument } from '../../domain/types';
import type { TPEdge, TPNode } from './flow-types';

export type GraphView = {
  nodes: TPNode[];
  edges: TPEdge[];
};

export const useGraphView = (doc: TPDocument): GraphView =>
  useMemo(() => {
    const entityList = Object.values(doc.entities);
    const edgeList = Object.values(doc.edges);

    const positions = computeLayout(
      entityList.map((e) => ({ id: e.id, width: NODE_WIDTH, height: NODE_MIN_HEIGHT })),
      edgeList.map((e) => ({ sourceId: e.sourceId, targetId: e.targetId }))
    );

    const nodes: TPNode[] = entityList.map((entity) => ({
      id: entity.id,
      type: 'tp',
      position: positions[entity.id] ?? { x: 0, y: 0 },
      data: { entity },
    }));

    const edges: TPEdge[] = edgeList.map((edge) => ({
      id: edge.id,
      source: edge.sourceId,
      target: edge.targetId,
      type: 'tp',
      data: { andGroupId: edge.andGroupId },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: edge.andGroupId ? EDGE_MARKER_AND : EDGE_MARKER_DEFAULT,
      },
    }));

    return { nodes, edges };
  }, [doc]);
