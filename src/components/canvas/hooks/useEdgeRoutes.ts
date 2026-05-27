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
import {
  JUNCTOR_EDGE_TERMINAL_OFFSET_Y,
  NODE_MIN_HEIGHT,
  NODE_WIDTH,
  ST_NODE_HEIGHT,
} from '@/domain/constants';
import {
  aStarOnGraph,
  type Box,
  bezierThroughWaypoints,
  buildVisibilityGraph,
  defaultBezierPath,
  type EdgeRoute,
  findBlockingObstacles,
  type Point,
} from '@/domain/edgeRouting';
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
  positions: GraphPositions,
  isJunctorMember: boolean
): { source: Point; target: Point } | null => {
  const sPos = positions[sourceId];
  const tPos = positions[targetId];
  if (!sPos || !tPos) return null;
  const sBox = obstacleBoxFor(doc, sourceId, sPos);
  const tBox = obstacleBoxFor(doc, targetId, tPos);
  if (!sBox || !tBox) return null;
  // Phase D — for junctor-grouped edges, the routed segment ends at
  // the BOTTOM perimeter of the junctor circle rather than the
  // target's top handle. JunctorOverlay paints the short line from
  // the circle into the target. Matches the existing TPEdge bezier
  // override at `targetY + JUNCTOR_EDGE_TERMINAL_OFFSET_Y`, so the
  // routed and unrouted geometries share the same endpoint.
  const targetY = isJunctorMember ? tBox.y + JUNCTOR_EDGE_TERMINAL_OFFSET_Y : tBox.y;
  return {
    source: { x: sBox.x + sBox.width / 2, y: sBox.y + sBox.height },
    target: { x: tBox.x + tBox.width / 2, y: targetY },
  };
};

/**
 * Pure helper — given the doc + projection + positions, produce the
 * per-edge route map. Phase D optimization: build the visibility
 * graph ONCE for the full obstacle set and call A\* per edge against
 * it, rather than rebuilding the graph for each edge.
 *
 * Per-edge cost is now dominated by A\* (~O(n² + n log n) for n
 * vertices) rather than visibility-graph construction (O(n² m)). On
 * 50 edges × 50 obstacles this drops total runtime by ~10× — what
 * the proposal's "≤ 50 ms for 500 edges" budget assumes.
 *
 * Aggregated `agg:` edges are not routed — their endpoints are
 * synthetic and the bucket-aggregation logic in `useGraphEdgeEmission`
 * already keys them with a different id. They fall through to the
 * default bezier.
 *
 * Iteration:
 *   1. Build the obstacle box map once — every visible node /
 *      collapsed-root that has a known position.
 *   2. Build the visibility graph over the FULL obstacle set, once.
 *   3. For each edge in `edgesArray(doc)`:
 *      - Resolve source / target through `projection.remap`.
 *      - Skip self-edges and edges where either endpoint disappears.
 *      - Run A\* on the cached graph from source → target. The
 *        endpoint obstacles ARE in the graph (their corners are
 *        valid waypoints) but won't intercept their own edge because
 *        visibility checks compare against shrunk-interior bounds.
 *      - Compose the resulting waypoint list into an SVG path.
 */
export const computeEdgeRoutes = (
  doc: TPDocument,
  projection: GraphProjection,
  positions: GraphPositions
): EdgeRouteMap => {
  // Build the universal obstacle box list once.
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
  const allBoxesArr: Box[] = [];
  // Parallel array of box ids in the same order as `allBoxesArr`.
  // Used inside the per-edge loop to skip the source/target boxes
  // from the visibility check on the fly.
  const allBoxIds: string[] = [];
  for (const [id, box] of allBoxes) {
    allBoxesArr.push(box);
    allBoxIds.push(id);
  }

  // Phase D — build the visibility graph once per layout pass.
  // O(n² m) work amortised across all edges in this `computeEdgeRoutes`
  // call (typically dozens to hundreds of edges per pass).
  const graph = buildVisibilityGraph(allBoxesArr);

  const out: Record<string, EdgeRoute> = {};
  // Track which remapped pairs we've already routed. The pair key
  // includes the junctor flag because a junctor-member edge ends at
  // a different y than a regular edge between the same endpoints,
  // and we want both keys to route independently (corner case: a
  // doc has both an AND-junctor edge and a non-junctor edge between
  // the same two nodes; rare, but well-defined).
  const seenPairs = new Set<string>();
  for (const edge of edgesArray(doc)) {
    const s = projection.remap(edge.sourceId);
    const t = projection.remap(edge.targetId);
    if (!s || !t || s === t) continue;
    // Phase D — junctor edges route to the junctor circle's bottom
    // perimeter, not the target's top handle. Match TPEdge's
    // existing override condition: any junctor-grouped edge that
    // hasn't been bucket-aggregated.
    const isJunctorMember = Boolean(edge.andGroupId || edge.orGroupId || edge.xorGroupId);
    const pairKey = `${s}->${t}:${isJunctorMember ? 'j' : 'd'}`;
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);
    const handles = handlePositionsFor(doc, s, t, positions, isJunctorMember);
    if (!handles) continue;
    // Phase D fix — the source/target handle positions sit on their
    // own box boundary, which means they fall *inside* the visibility
    // graph's shrunk-interior bounds. Without exclusion, A\* would
    // think the source can't see any corner outside its own box and
    // fail. Pass the source/target box indices so the visibility
    // check skips them for this edge's queries.
    const sourceBoxIdx = allBoxIds.indexOf(s);
    const targetBoxIdx = allBoxIds.indexOf(t);
    const path = aStarOnGraph(graph, handles.source, handles.target, sourceBoxIdx, targetBoxIdx);
    if (!path || path.length < 2) {
      // A\* failed — likely source/target inside an obstacle. Fall
      // back to the default bezier.
      out[edge.id] = {
        d: defaultBezierPath(handles.source, handles.target),
        waypoints: [handles.source, handles.target],
      };
      continue;
    }
    if (path.length === 2) {
      // Direct visibility — emit the default bezier (skipping the
      // straight-line "L" path A\* might have used).
      // Only use the bezier when the straight line is genuinely
      // obstacle-free at the BEZIER level (not just at the polyline
      // level the visibility-graph reasons about). The bezier's
      // curvature can dip into obstacles a straight line clears.
      const obstaclesForEdge: Box[] = [];
      for (let i = 0; i < allBoxesArr.length; i++) {
        const id = allBoxIds[i];
        const box = allBoxesArr[i];
        if (!box || id === s || id === t) continue;
        obstaclesForEdge.push(box);
      }
      const blockers = findBlockingObstacles(handles.source, handles.target, obstaclesForEdge);
      if (blockers.length === 0) {
        out[edge.id] = {
          d: defaultBezierPath(handles.source, handles.target),
          waypoints: [handles.source, handles.target],
        };
      } else {
        // The straight line is clear at the polyline level but the
        // curved bezier dips into an obstacle. Use the polyline
        // straight-line as the path (no curvature → guaranteed
        // obstacle-free).
        out[edge.id] = {
          d: bezierThroughWaypoints([handles.source, handles.target]),
          waypoints: [handles.source, handles.target],
        };
      }
      continue;
    }
    out[edge.id] = {
      d: bezierThroughWaypoints(path),
      waypoints: path,
    };
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
