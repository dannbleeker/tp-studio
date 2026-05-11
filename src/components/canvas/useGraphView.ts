import { NODE_MIN_HEIGHT, NODE_WIDTH } from '@/domain/constants';
import { layoutFingerprint } from '@/domain/fingerprint';
import { computeLayout } from '@/domain/layout';
import { EDGE_MARKER_AND, EDGE_MARKER_DEFAULT } from '@/domain/tokens';
import type { TPDocument } from '@/domain/types';
import { MarkerType } from '@xyflow/react';
import { useMemo } from 'react';
import type { TPEdge, TPNode } from './flow-types';

export type GraphView = {
  nodes: TPNode[];
  edges: TPEdge[];
};

export const useGraphView = (doc: TPDocument): GraphView => {
  // Layout is the expensive part (dagre). It depends only on entity IDs and
  // edge endpoints / AND grouping — not titles or types. Memoize against a
  // structural fingerprint so title edits don't re-run dagre.
  const fp = layoutFingerprint(doc);
  // biome-ignore lint/correctness/useExhaustiveDependencies: doc is read through `fp` deliberately so title edits don't re-run dagre.
  const positions = useMemo(() => {
    const entityList = Object.values(doc.entities);
    const edgeList = Object.values(doc.edges);
    return computeLayout(
      entityList.map((e) => ({ id: e.id, width: NODE_WIDTH, height: NODE_MIN_HEIGHT })),
      edgeList.map((e) => ({ sourceId: e.sourceId, targetId: e.targetId }))
    );
  }, [fp]);

  // The view derivation is cheap. It does need `doc` directly so the node
  // `data.entity` updates when titles change.
  return useMemo(() => {
    const entityList = Object.values(doc.entities);
    const edgeList = Object.values(doc.edges);

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
  }, [doc, positions]);
};
