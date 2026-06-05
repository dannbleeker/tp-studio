import type { DetailedRevisionDiff } from '@/domain/revisions';
import type { EntityId, EntityState, TPDocument } from '@/domain/types';
import type { AnyTPNode, TPEdge } from '../edges/flow-types';
import type { EdgeRouteMap } from './useEdgeRoutes';
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
  compareDiff: DetailedRevisionDiff | null,
  derivedStates: Record<EntityId, EntityState>,
  speculationOverlay: Record<string, EntityState> | null,
  showActionEligibility = false,
  // The routed-path map from `useEdgeRoutes`, threaded in by `useGraphView`.
  // Defaults to `{}` so tests that mount `useGraphEmission` directly keep
  // working with the existing positional argument list.
  routes: EdgeRouteMap = {},
  // Wave 3 — flow-aware back-edge set from `useGraphView`; threaded to edge
  // emission for the back-edge colour/dash + `data.isBackEdge` stamp.
  backEdgeIds?: ReadonlySet<string>
): GraphEmission => {
  const nodes = useGraphNodeEmission(
    doc,
    projection,
    positions,
    compareDiff,
    derivedStates,
    speculationOverlay,
    showActionEligibility
  );
  const edges = useGraphEdgeEmission(doc, projection, routes, backEdgeIds);
  return { nodes, edges };
};
