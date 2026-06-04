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
import { JUNCTOR_CENTER_OFFSET_Y, JUNCTOR_RADIUS, JUNCTOR_RADIUS_X } from '@/domain/constants';
import {
  aStarOnGraph,
  type Box,
  bezierThroughWaypointsSided,
  buildVisibilityGraph,
  type EdgeRoute,
  findBlockingObstaclesSided,
  type Point,
  sideBezierSegment,
} from '@/domain/edgeRouting';
import { type Axis, type SideSelection, selectEdgeSides } from '@/domain/edgeSides';
import { edgesArray } from '@/domain/graph';
import { HANDLE_ORIENTATION } from '@/domain/layoutStrategy';
import type { TPDocument } from '@/domain/types';
import { useDocumentStore } from '@/store';
import { junctorCenterX } from '../edges/junctorGeometry';
import { nodeSizeFor } from './graphViewConstants';

/** Padding around a junctor circle's obstacle box, so routed edges clear the
 *  visible ellipse rather than grazing it. */
const JUNCTOR_OBSTACLE_MARGIN = 8;

/** Extra padding added to every obstacle box FOR ROUTING ONLY (anchoring still
 *  uses the exact `allBoxes`), so a routed edge that passes a card it isn't
 *  attached to keeps a visible gap instead of grazing the card and reading as if
 *  it were connected to it. */
const NODE_OBSTACLE_MARGIN = 10;

/** Grow a box by `margin` on every side. */
const inflateBox = (box: Box, margin: number): Box => ({
  x: box.x - margin,
  y: box.y - margin,
  width: box.width + margin * 2,
  height: box.height + margin * 2,
});

import type { GraphPositions } from './useGraphPositions';
import type { GraphProjection } from './useGraphProjection';

/** Map from edge id → routed geometry. Empty when the user opts out
 *  (`StoredPrefs.edgeRouting === 'direct'`). */
export type EdgeRouteMap = Readonly<Record<string, EdgeRoute>>;

/**
 * Compute the obstacle bounding box for a visible node (entity or
 * collapsed-root) given its top-left position from {@link GraphPositions}.
 * The size comes from the shared {@link nodeSizeFor} rule, so the router's
 * obstacle picture stays in lockstep with what dagre laid out; `null` for an
 * id that is neither a known entity nor a group (skip it as an obstacle).
 */
const obstacleBoxFor = (doc: TPDocument, id: string, position: Point): Box | null => {
  const size = nodeSizeFor(doc, id);
  if (!size) return null;
  return { x: position.x, y: position.y, width: size.width, height: size.height };
};

/**
 * Obstacle boxes for the AND/OR/XOR junctor circles in `doc` (one per group,
 * keyed `junctor:<groupId>`). The router adds these so unrelated edges route
 * AROUND a junctor instead of passing behind its circle. Geometry mirrors
 * `JunctorOverlay` / `useJunctorCenterX`: the circle centres over its causes
 * (`junctorCenterX`), `JUNCTOR_CENTER_OFFSET_Y` below the target's bottom, with a
 * small margin so edges clear the visible ellipse. Skips a group whose target
 * has no known position/size yet. Exported for unit testing.
 */
export const junctorObstacleBoxes = (
  doc: TPDocument,
  positions: GraphPositions
): Map<string, Box> => {
  const groups = new Map<string, { targetId: string; sourceIds: string[] }>();
  for (const edge of edgesArray(doc)) {
    const gid = edge.andGroupId ?? edge.orGroupId ?? edge.xorGroupId;
    if (!gid) continue;
    const g = groups.get(gid);
    if (g) g.sourceIds.push(edge.sourceId);
    else groups.set(gid, { targetId: edge.targetId, sourceIds: [edge.sourceId] });
  }
  const boxes = new Map<string, Box>();
  for (const [gid, g] of groups) {
    const tPos = positions[g.targetId];
    const tSize = nodeSizeFor(doc, g.targetId);
    if (!tPos || !tSize) continue;
    const causeXs: number[] = [];
    for (const sid of g.sourceIds) {
      const sPos = positions[sid];
      const sSize = nodeSizeFor(doc, sid);
      if (sPos && sSize) causeXs.push(sPos.x + sSize.width / 2);
    }
    const cx = junctorCenterX(causeXs, tPos.x + tSize.width / 2);
    const cy = tPos.y + tSize.height + JUNCTOR_CENTER_OFFSET_Y;
    const halfW = JUNCTOR_RADIUS_X + JUNCTOR_OBSTACLE_MARGIN;
    const halfH = JUNCTOR_RADIUS + JUNCTOR_OBSTACLE_MARGIN;
    boxes.set(`junctor:${gid}`, {
      x: cx - halfW,
      y: cy - halfH,
      width: halfW * 2,
      height: halfH * 2,
    });
  }
  return boxes;
};

/**
 * Choose the source / target side + anchor point for one edge (Feature
 * #5). Replaces the old fixed source-bottom / target-top anchoring with
 * {@link selectEdgeSides}, which picks the facing sides by relative
 * position and can switch sides to keep the connector short or dodge a
 * node. The old fixed anchors landed on the away-facing sides under
 * dagre `BT` (cause below, effect above); the position-based picker
 * corrects that.
 *
 * Junctor-grouped edges are NOT routed here — `computeEdgeRoutes` skips them
 * (see the loop comment) so they render via TPEdge's measured-exact bezier
 * into the junctor circle. So this only ever sees non-junctor edges.
 */
const sideSelectionFor = (
  sourceBox: Box,
  targetBox: Box,
  axis: Axis,
  obstacles: readonly Box[]
): SideSelection => selectEdgeSides({ sourceBox, targetBox, axis, obstacles });

/**
 * The per-layout routing context shared by every edge in one `computeEdgeRoutes`
 * pass: the cached visibility graph + the inflated obstacle arrays + the flow
 * axis. Bundled so {@link routeOneEdge} can be re-invoked (e.g. a future
 * crossing-aware reroute) without rebuilding the graph.
 */
type RouteContext = {
  graph: ReturnType<typeof buildVisibilityGraph>;
  axis: Axis;
  /** Inflated obstacle boxes (clearance applied), parallel to {@link RouteContext.allBoxIds}. */
  allBoxesArr: readonly Box[];
  allBoxIds: readonly string[];
  boxIdToIndex: ReadonlyMap<string, number>;
};

/**
 * Route a single non-junctor edge between two boxes through the shared visibility
 * graph: pick the facing sides (dodging obstacles), run A\* on the cached graph,
 * and compose the waypoint list into a side-aware bezier (or a dead-straight
 * segment when the curve would dip into an obstacle a straight line clears).
 *
 * Extracted verbatim from `computeEdgeRoutes`' per-edge loop (behaviour-preserving
 * — the `useEdgeRoutes` waypoint tests pin it) so a crossing-aware reroute can call
 * it again for one edge without duplicating the body. The endpoint boxes are
 * excluded from this edge's obstacle set (an edge can't be blocked by its own
 * endpoints) and skipped in the A\* visibility check via their box indices.
 */
const routeOneEdge = (s: string, t: string, sBox: Box, tBox: Box, ctx: RouteContext): EdgeRoute => {
  // Per-edge obstacle set — every visible box except this edge's own two
  // endpoints. Shared by the side picker (which sides are clear?) and the
  // curvature-dip check below.
  const obstaclesForEdge: Box[] = [];
  for (let i = 0; i < ctx.allBoxesArr.length; i++) {
    const id = ctx.allBoxIds[i];
    const box = ctx.allBoxesArr[i];
    if (!box || id === s || id === t) continue;
    obstaclesForEdge.push(box);
  }
  const sel = sideSelectionFor(sBox, tBox, ctx.axis, obstaclesForEdge);
  // The anchor points sit on their own box boundary, so they fall *inside* the
  // visibility graph's shrunk-interior bounds. Pass the source/target box indices
  // so the visibility check skips them for this edge's queries.
  const sourceBoxIdx = ctx.boxIdToIndex.get(s) ?? -1;
  const targetBoxIdx = ctx.boxIdToIndex.get(t) ?? -1;
  const path = aStarOnGraph(
    ctx.graph,
    sel.sourceAnchor,
    sel.targetAnchor,
    sourceBoxIdx,
    targetBoxIdx
  );
  // The A\*-failed and direct-visibility branches both emit the same side-aware
  // curve between the chosen anchors — keep it in one place.
  const sidedCurve = () =>
    sideBezierSegment(sel.sourceAnchor, sel.sourceSide, sel.targetAnchor, sel.targetSide);
  const directWaypoints = [sel.sourceAnchor, sel.targetAnchor];
  if (!path || path.length < 2) {
    // A\* failed — likely source/target inside an obstacle. Fall back to the
    // side-aware bezier between the chosen anchors.
    return { d: sidedCurve(), waypoints: directWaypoints };
  }
  if (path.length === 2) {
    // Direct visibility. Emit the side-aware curve unless its curvature dips into
    // an obstacle a straight line would clear — in which case use the dead-straight
    // segment (cannot dip).
    const dips =
      findBlockingObstaclesSided(
        sel.sourceAnchor,
        sel.sourceSide,
        sel.targetAnchor,
        sel.targetSide,
        obstaclesForEdge
      ).length > 0;
    return {
      d: dips
        ? `M${sel.sourceAnchor.x},${sel.sourceAnchor.y} L${sel.targetAnchor.x},${sel.targetAnchor.y}`
        : sidedCurve(),
      waypoints: directWaypoints,
    };
  }
  return {
    d: bezierThroughWaypointsSided(path, sel.sourceSide, sel.targetSide),
    waypoints: path,
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
  // Feature #5 — the layout's main flow axis drives the "prefer flow
  // direction" side choice: vertical for the dagre trees, horizontal
  // for Evaporating Cloud.
  const axis: Axis = HANDLE_ORIENTATION[doc.diagramType];
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
  // Junctor circles are overlays the router otherwise can't see, so an unrelated
  // edge — e.g. a cause node's OTHER outgoing edge — can pass behind an AND/OR/XOR
  // circle and read as if it connects to it. Add each junctor's circle as an
  // obstacle box (synthetic `junctor:<gid>` id — never an edge endpoint, so it
  // blocks every routed edge) so those edges route AROUND it. The junctor's own
  // cause edges are skipped below, so they're unaffected.
  for (const [id, box] of junctorObstacleBoxes(doc, positions)) allBoxes.set(id, box);
  const allBoxesArr: Box[] = [];
  // Parallel array of box ids in the same order as `allBoxesArr`.
  // Used inside the per-edge loop to skip the source/target boxes
  // from the visibility check on the fly.
  const allBoxIds: string[] = [];
  // id → index into the parallel arrays. Built once so the per-edge
  // source/target box-index lookups below are O(1); the previous
  // `allBoxIds.indexOf(...)` inside the edge loop made the routing pass
  // O(N·E) (N visible boxes × E edges) on large diagrams.
  const boxIdToIndex = new Map<string, number>();
  for (const [id, box] of allBoxes) {
    boxIdToIndex.set(id, allBoxesArr.length);
    // The graph + per-edge obstacle sets use the INFLATED box (clearance); the
    // `allBoxes` map keeps the exact box for source/target anchoring below.
    allBoxesArr.push(inflateBox(box, NODE_OBSTACLE_MARGIN));
    allBoxIds.push(id);
  }

  // Phase D — build the visibility graph once per layout pass.
  // O(n² m) work amortised across all edges in this `computeEdgeRoutes`
  // call (typically dozens to hundreds of edges per pass).
  const graph = buildVisibilityGraph(allBoxesArr);
  const ctx: RouteContext = { graph, axis, allBoxesArr, allBoxIds, boxIdToIndex };

  const out: Record<string, EdgeRoute> = {};
  // Track which remapped pairs we've already routed — one route per visible
  // src→tgt pair (aggregation collapses parallels upstream).
  const seenPairs = new Set<string>();
  for (const edge of edgesArray(doc)) {
    const s = projection.remap(edge.sourceId);
    const t = projection.remap(edge.targetId);
    if (!s || !t || s === t) continue;
    // Junctor-member edges are intentionally NOT routed through A*. Their
    // visible path is TPEdge's bezier, redirected to the junctor circle's
    // bottom perimeter via the target's MEASURED bottom-handle Y, so it lands
    // exactly on the circle JunctorOverlay paints. The router only knows
    // fixed NODE_MIN_HEIGHT obstacle boxes, so a routed terminus sat ~a
    // node-height off the (measured) circle — the "AND/OR/XOR cause-edges
    // don't meet the circle" bug. Skipping them mirrors the radial exclusion
    // in TPEdge; one short JunctorOverlay line owns the arrow into the target.
    if (edge.andGroupId || edge.orGroupId || edge.xorGroupId) continue;
    const pairKey = `${s}->${t}`;
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);
    const sBox = allBoxes.get(s);
    const tBox = allBoxes.get(t);
    if (!sBox || !tBox) continue;
    out[edge.id] = routeOneEdge(s, t, sBox, tBox, ctx);
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
  // Keyed on the structural doc fields `computeEdgeRoutes` reads — `edges`
  // (via `edgesArray`, the route set, incl. junctor membership), `entities` +
  // `groups` (obstacle box geometry), `diagramType` (radial vs flow) — NOT the
  // whole `doc`. Without this the A* routing re-ran on EVERY mutation, which
  // (since `routes` feeds edge emission) defeated the edge-emission dep
  // narrowing. Now a non-structural edit (CLR-resolve, document title,
  // customEntityClasses, comments, assumptions) leaves these refs intact, so
  // routing — and the edge emission downstream of it — skips entirely.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reads `doc` whole but only via edges/entities/groups/diagramType; narrowed deliberately.
  return useMemo<EdgeRouteMap>(() => {
    if (!smartRouting) return {};
    return computeEdgeRoutes(doc, projection, positions);
  }, [smartRouting, doc.edges, doc.entities, doc.groups, doc.diagramType, projection, positions]);
};
