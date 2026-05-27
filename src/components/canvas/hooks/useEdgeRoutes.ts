/**
 * Edge routing pipeline bridge — `useGraphView` → `routeEdge` adapter.
 * See `docs/EDGE_ROUTING_PROPOSAL.md`.
 *
 * Pipeline position:
 *
 *   useGraphProjection  →  useGraphPositions  →  useEdgeRoutes (this)
 *                                                ↓
 *                                            useGraphEmission stamps
 *                                            `data.route` per edge
 *
 * Phase C (current) — the smart routing gate is now a store-backed
 * preference read (`s.edgeRouting === 'smart'`). The default is
 * `'smart'` per the proposal's locked decision; the `'direct'`
 * opt-out is exposed in Settings → Display. When set to `'direct'`,
 * this hook returns `{}` and every edge falls through to React Flow's
 * default bezier (the pre-Phase-C behavior). When set to `'smart'`,
 * `computeEdgeRoutes` builds the per-edge route map via the
 * visibility-graph + A\* router.
 *
 * `computeEdgeRoutes` is the pure helper. Tests exercise it directly
 * so we can pin the iteration logic + per-edge `routeEdge` calls
 * regardless of the user's preference.
 */

import { useMemo } from 'react';
import { NODE_MIN_HEIGHT, NODE_WIDTH, ST_NODE_HEIGHT } from '@/domain/constants';
import { type Box, type EdgeRoute, type Point, routeEdge } from '@/domain/edgeRouting';
import { edgesArray, isStNodeFormat } from '@/domain/graph';
import type { TPDocument } from '@/domain/types';
import { useDocumentStore } from '@/store';
import { COLLAPSED_HEIGHT, COLLAPSED_WIDTH } from './graphViewConstants';
import type { GraphPositions } from './useGraphPositions';
import type { GraphProjection } from './useGraphProjection';

/** Map from edge id → routed geometry. Empty when the user opts out
 *  (`StoredPrefs.edgeRouting === 'direct'`). */
export type EdgeRouteMap = Readonly<Record<string, EdgeRoute>>;

/**
 * Compute the obstacle bounding box for a visible node (entity or
 * collapsed-root) given its top-left position from
 * {@link GraphPositions}. Uses the same width/height heuristics as
 * `useGraphPositions.buildLayoutInputs`: entities default to
 * `NODE_WIDTH × NODE_MIN_HEIGHT`, S&T-format entities use
 * `ST_NODE_HEIGHT`, and collapsed-roots use `COLLAPSED_WIDTH ×
 * COLLAPSED_HEIGHT`. Keeping the same per-kind switch keeps the
 * router's obstacle picture in lockstep with what dagre laid out.
 */
const obstacleBoxFor = (doc: TPDocument, id: string, position: Point): Box | null => {
  const entity = doc.entities[id];
  if (entity) {
    const height = isStNodeFormat(entity) ? ST_NODE_HEIGHT : NODE_MIN_HEIGHT;
    return { x: position.x, y: position.y, width: NODE_WIDTH, height };
  }
  // Group-collapsed root — uses the dedicated COLLAPSED_* dimensions.
  if (doc.groups[id]) {
    return { x: position.x, y: position.y, width: COLLAPSED_WIDTH, height: COLLAPSED_HEIGHT };
  }
  return null;
};

/**
 * Compute the source / target handle positions for an edge given the
 * top-left node positions in `positions`. The default React Flow
 * handle layout on TPNode is `Position.Bottom` for the source handle
 * and `Position.Top` for the target. We match those exactly so the
 * routed bezier joins the same anchor points the unrouted edge would
 * have used.
 *
 * Returns `null` if either endpoint's position or box is missing —
 * happens transiently between a layout invalidation and the next
 * dagre re-run.
 */
const handlePositionsFor = (
  doc: TPDocument,
  sourceId: string,
  targetId: string,
  positions: GraphPositions
): { source: Point; target: Point } | null => {
  const sPos = positions[sourceId];
  const tPos = positions[targetId];
  if (!sPos || !tPos) return null;
  const sBox = obstacleBoxFor(doc, sourceId, sPos);
  const tBox = obstacleBoxFor(doc, targetId, tPos);
  if (!sBox || !tBox) return null;
  return {
    source: { x: sBox.x + sBox.width / 2, y: sBox.y + sBox.height },
    target: { x: tBox.x + tBox.width / 2, y: tBox.y },
  };
};

/**
 * Pure helper — given the doc + projection + positions, produce the
 * per-edge route map by iterating the visible edges and calling
 * `routeEdge` per edge. Tests exercise this directly; the hook below
 * calls it when the user's preference is `'smart'`.
 *
 * Iteration:
 *   1. Build the obstacle list once per call — every visible node /
 *      collapsed-root that has a known position. Each edge filters
 *      out its own source + target by id when it picks its own
 *      obstacle subset.
 *   2. For each edge in `edgesArray(doc)`:
 *      - Resolve source / target through `projection.remap` to handle
 *        collapsed-group endpoints.
 *      - Skip self-edges and edges where either endpoint disappears.
 *      - Look up handle positions + the per-edge obstacle subset.
 *      - Call `routeEdge` and stamp the result keyed by the real edge id.
 *
 * Aggregated `agg:` edges are not routed — their endpoints are
 * synthetic and the bucket-aggregation logic in `useGraphEdgeEmission`
 * already keys them with a different id. They fall through to the
 * default bezier.
 */
export const computeEdgeRoutes = (
  doc: TPDocument,
  projection: GraphProjection,
  positions: GraphPositions
): EdgeRouteMap => {
  // Build the universal obstacle box list once. Per-edge filtering
  // (drop own source + target) happens inside the loop because
  // each edge sees a different subset.
  const allBoxes = new Map<string, Box>();
  for (const id of projection.visibleEntityIds) {
    const pos = positions[id];
    if (!pos) continue;
    const box = obstacleBoxFor(doc, id, pos);
    if (box) allBoxes.set(id, box);
  }
  for (const id of projection.visibleCollapsedRoots) {
    const pos = positions[id];
    if (!pos) continue;
    const box = obstacleBoxFor(doc, id, pos);
    if (box) allBoxes.set(id, box);
  }

  // We use a mutable map internally then freeze it on return so the
  // public shape stays `Readonly<Record<...>>`.
  const out: Record<string, EdgeRoute> = {};
  // Track which remapped pairs we've already routed so the same
  // visible edge isn't routed multiple times when several underlying
  // edges share an endpoint pair (matches the aggregation logic in
  // `useGraphEdgeEmission`). We key only the first underlying edge id
  // since `data.route` is also keyed by that id.
  const seenPairs = new Set<string>();
  for (const edge of edgesArray(doc)) {
    const s = projection.remap(edge.sourceId);
    const t = projection.remap(edge.targetId);
    if (!s || !t || s === t) continue;
    const pairKey = `${s}->${t}`;
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);
    const handles = handlePositionsFor(doc, s, t, positions);
    if (!handles) continue;
    // Obstacle subset for this edge: everything visible EXCEPT the
    // two endpoints. Done per-edge because each edge sees a slightly
    // different subset.
    const obstacles: Box[] = [];
    for (const [id, box] of allBoxes) {
      if (id === s || id === t) continue;
      obstacles.push(box);
    }
    const route = routeEdge({ source: handles.source, target: handles.target, obstacles });
    out[edge.id] = route;
  }
  return out;
};

/**
 * React hook wrapper. Reads the user's `edgeRouting` preference and
 * either computes the route map (`'smart'`) or returns `{}` so every
 * edge falls through to the default bezier (`'direct'`).
 */
export const useEdgeRoutes = (
  doc: TPDocument,
  projection: GraphProjection,
  positions: GraphPositions
): EdgeRouteMap => {
  const smartRouting = useDocumentStore((s) => s.edgeRouting === 'smart');
  return useMemo<EdgeRouteMap>(() => {
    if (!smartRouting) return {};
    return computeEdgeRoutes(doc, projection, positions);
  }, [smartRouting, doc, projection, positions]);
};
