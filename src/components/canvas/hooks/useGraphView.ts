import { useMemo } from 'react';
import { effectiveBackEdgeIds } from '@/domain/backEdges';
import { HANDLE_ORIENTATION } from '@/domain/layoutStrategy';
import type { TPDocument } from '@/domain/types';
import { useCompareDiff } from '@/hooks/useCompareDiff';
import { usePropagatedStates } from '@/hooks/usePropagatedStates';
import { useDocumentStore } from '@/store';
import type { AnyTPNode, TPEdge } from '../edges/flow-types';
import { useEdgeRoutes } from './useEdgeRoutes';
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
  // Wave 3 — the flow-aware back-edge set (manual ∪ the against-flow auto-detected
  // loop-closer). Computed ONCE here, where positions live, then handed to both
  // routing (the loop) and emission (the colour/dash + `data.isBackEdge` stamp) so
  // they never disagree. `TPEdge` reads the stamp — it can't see all positions to
  // make the against-flow pick itself.
  const axis = HANDLE_ORIENTATION[doc.diagramType];
  const rawBackEdgeIds = useMemo(
    () => effectiveBackEdgeIds(doc, { positions, axis }),
    [doc.edges, positions, axis]
  );
  // Stabilize the ref on the set's CONTENTS, not its identity, so the position-
  // independent edge-emission memo holds across a position-only drag (the set only
  // changes when a node crosses the flow enough to flip the chain-spanning closer).
  const backEdgeKey = [...rawBackEdgeIds].sort().join('|');
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on `backEdgeKey` (the set contents) by design — see comment above.
  const backEdgeIds = useMemo(() => rawBackEdgeIds, [backEdgeKey]);
  // Obstacle-aware edge routing — computes per-edge routed paths for flow
  // layouts. Preference-gated with the smart router as the live default
  // (Settings → Display → Edge routing; see `docs/EDGE_ROUTING_PROPOSAL.md`
  // and `useEdgeRoutes`). Returns an empty map when routing is disabled or
  // the layout is radial (which has its own router), so emission falls back
  // to the bezier path for those edges.
  const routes = useEdgeRoutes(doc, projection, positions, backEdgeIds);
  // H2: when a compare revision is active, fetch the detailed diff so
  // emission can stamp `diffStatus` on each node. Returns null in normal
  // viewing mode — no diff overhead when not comparing.
  const compareDiff = useCompareDiff();
  // Session 135 / spec gap #4 — propagation-derived states + the
  // active speculation overlay. Both feed the per-node state badge in
  // emission. `derivedStates` is memoized on (entities, edges,
  // overlay) so it's a stable ref across position-only drags.
  const derivedStates = usePropagatedStates();
  const speculationOverlay = useDocumentStore((s) => s.speculationOverlay);
  // Session 135 — opt-in at-a-glance eligibility badge on TT Action
  // nodes. Threaded so emission only pays the per-action eligibility
  // fold when the toggle is on (off → the field is never stamped).
  const showActionEligibility = useDocumentStore((s) => s.showActionEligibility);
  return useGraphEmission(
    doc,
    projection,
    positions,
    compareDiff,
    derivedStates,
    speculationOverlay,
    showActionEligibility,
    routes,
    backEdgeIds
  );
};
