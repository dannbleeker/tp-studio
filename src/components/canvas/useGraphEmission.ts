import type { DetailedRevisionDiff } from '@/domain/revisions';
import type { TPDocument } from '@/domain/types';
import type { AnyTPNode, TPEdge } from './flow-types';
import { useGraphEdgeEmission } from './useGraphEdgeEmission';
import { useGraphNodeEmission } from './useGraphNodeEmission';
import type { GraphPositions } from './useGraphPositions';
import type { GraphProjection } from './useGraphProjection';

/**
 * Stage 3 of the three-stage graph-view pipeline. Composes the per-kind
 * emitters and returns the unified `{ nodes, edges }` shape `useGraphView`
 * hands to the canvas.
 *
 * Splitting into per-kind hooks (Session 39, #9 from the next-batch top-10)
 * tightens each memo's dependency surface:
 *
 *   - {@link useGraphNodeEmission} reads positions → re-runs on drag.
 *   - {@link useGraphEdgeEmission} doesn't read positions → stable across drags.
 *
 * Previously the combined emission re-ran the edge bucket-aggregation pass
 * every time a manual-layout diagram's positions changed; now those drags
 * skip the edge work entirely.
 */
export type GraphEmission = {
  nodes: AnyTPNode[];
  edges: TPEdge[];
};

export const useGraphEmission = (
  doc: TPDocument,
  projection: GraphProjection,
  positions: GraphPositions,
  compareDiff: DetailedRevisionDiff | null
): GraphEmission => {
  const nodes = useGraphNodeEmission(doc, projection, positions, compareDiff);
  const edges = useGraphEdgeEmission(doc, projection);
  return { nodes, edges };
};
