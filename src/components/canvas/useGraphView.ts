import type { TPDocument } from '@/domain/types';
import { useCompareDiff } from '@/hooks/useCompareDiff';
import type { AnyTPNode, TPEdge } from './flow-types';
import { useGraphEmission } from './useGraphEmission';
import { useGraphPositions } from './useGraphPositions';
import { useGraphProjection } from './useGraphProjection';

export type GraphView = {
  nodes: AnyTPNode[];
  edges: TPEdge[];
};

/**
 * Derive the React Flow node/edge view from the current doc, honoring the
 * UI's collapse state (per-group and per-entity) and hoist state (single
 * hoisted group).
 *
 * The transform proceeds in three composed stages. Each stage is a separate
 * hook in its own file; this file is just the composition so a consumer
 * (`Canvas.tsx`) gets the unified `{ nodes, edges }` it expects.
 *
 *   1. {@link useGraphProjection} — compute the visible-entity set and the
 *      `remap` callback that resolves cross-collapse-boundary endpoints to
 *      their collapsed-root stand-ins.
 *   2. {@link useGraphPositions} — run dagre (or radial, or read-stored)
 *      over the projected set. Memoized on the layout fingerprint so
 *      title-only edits don't churn the layout.
 *   3. {@link useGraphEmission} — emit RF nodes (entities, collapsed-roots,
 *      group rects) and edges (bucket-aggregated, AND-aware).
 *
 * Splitting the original ~330-line monolith into these three hooks keeps
 * each stage testable in isolation and makes it obvious which stage owns
 * which behavior — invaluable when (for example) adding a new node kind
 * (just emission) versus changing what's visible (just projection).
 */
export const useGraphView = (doc: TPDocument): GraphView => {
  const projection = useGraphProjection(doc);
  const positions = useGraphPositions(doc, projection);
  // H2: when a compare revision is active, fetch the detailed diff so
  // emission can stamp `diffStatus` on each node. Returns null in normal
  // viewing mode — no diff overhead when not comparing.
  const compareDiff = useCompareDiff();
  return useGraphEmission(doc, projection, positions, compareDiff);
};
