/**
 * Edge routing module — obstacle-aware path finding for the dagre / flow
 * layout. See `docs/EDGE_ROUTING_PROPOSAL.md` for the full design.
 *
 * Phasing on main:
 *   - **Phase A** (shipped): API contract + types + no-op `routeEdge`
 *     returning a bezier verbatim.
 *   - **Phase B** (this revision): single-obstacle deflection heuristic.
 *     Bezier-sample hit-test against axis-aligned boxes; when exactly
 *     one obstacle blocks the curve, emit a smoothed two-cubic path
 *     through a waypoint placed above or below the obstacle (shorter
 *     side wins). Zero or two-plus blockers fall through to the Phase
 *     A bezier — multi-obstacle is Phase C's visibility-graph + A\*.
 *   - **Phase C** (planned): visibility graph + A\* + flip the gate.
 *
 * Layered intent: this is a pure-geometry domain function. It does NOT
 * read the store, does NOT depend on React, and does NOT touch React
 * Flow's `getBezierPath`. The point string returned is consumable by
 * any SVG renderer; `useEdgeRoutes` is the React adapter that calls
 * this and stamps the result onto each edge's `data.route`.
 *
 * The radial layout has its own router at
 * `src/components/canvas/edges/radialEdgeRouting.ts` (Session 99); the
 * two are intentionally separate. Radial routing deflects a bezier
 * perpendicular to its axis (cheap, good enough for tree geometry);
 * dagre routing in Phase C will use a real pathfinder (visibility
 * graph + A\*) so it can handle the dense / multi-obstacle cases that
 * dagre layouts hit but radial layouts don't.
 */

/** A point in flow coordinates (pre-viewport-transform). */
export type Point = { readonly x: number; readonly y: number };

/**
 * Axis-aligned bounding box represented by its top-left corner + size.
 * This matches how dagre and React Flow store node positions (top-left
 * + width / height). The radial router uses a center+half-extents
 * representation in its own module — the two formats are isomorphic but
 * we keep each module's convention local so callers don't need to
 * translate.
 */
export type Box = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/**
 * Input to {@link routeEdge}. Source / target are the visible edge
 * endpoints (handle positions, not node centers). Obstacles are the
 * bounding boxes of every NON-endpoint visible node — the caller has
 * already filtered out the source and target node so the router
 * doesn't accidentally treat its own endpoints as obstacles. Optional
 * `rankSpacing` will be used in Phase C+ to place intermediate
 * waypoints at rank boundaries on multi-rank edges; ignored prior to C.
 *
 * `obstaclePadding` lets the caller widen each obstacle by a fixed
 * margin before hit-testing — the visible node footprint is the
 * bounding box, but routes that just graze a node read worse than
 * routes that clear it cleanly. Default is `OBSTACLE_PADDING` (8 px,
 * per the proposal's "padded axis-aligned bounding box" decision).
 */
export type RoutingInput = {
  readonly source: Point;
  readonly target: Point;
  readonly obstacles: readonly Box[];
  readonly rankSpacing?: number;
  readonly obstaclePadding?: number;
};

/**
 * Output of {@link routeEdge}.
 *
 * `d` is a precomputed SVG path string consumable by React Flow's
 * `<BaseEdge path={...}>` prop verbatim. `waypoints` is the corner
 * list (source + interior corners + target) exposed for any future
 * consumer that needs hit-testing, label placement, or animation
 * along the route. Phase A returned just `[source, target]`; Phase B
 * adds a single interior corner when the single-obstacle heuristic
 * fires. Phase C populates richer corner lists from A\*.
 */
export type EdgeRoute = {
  readonly d: string;
  readonly waypoints: readonly Point[];
};

/**
 * Default obstacle padding. The hit-test treats each obstacle box as
 * if it were `OBSTACLE_PADDING` px wider on every side — gives a
 * "no-fly zone" so the routed curve clears the node body with room
 * for the stroke + label band. Per the proposal's question #4: 8 px.
 */
export const OBSTACLE_PADDING = 8;

/**
 * Detour clearance — extra distance between the waypoint and the
 * obstacle's nearest edge. Larger values produce more dramatic curves
 * that read clearly as "going around"; smaller values hug the
 * obstacle more tightly. 16 px matches the visual feel of the radial
 * router's deflection margin.
 */
export const DETOUR_CLEARANCE = 16;

/**
 * Number of samples used to approximate the cubic bezier when hit-
 * testing against obstacles. 8 samples → 7 line segments per bezier.
 * Per the proposal's risk section: "we'll approximate by sampling
 * the bezier at 8 points and testing each segment". The math is
 * O(samples × obstacles) per edge, well under the perf budget.
 */
const BEZIER_SAMPLE_COUNT = 8;

/**
 * Build a smooth cubic bezier between two points with vertical-dominant
 * control points. This matches the visual feel of React Flow's
 * `getBezierPath` for our default handle layout (source at
 * Position.Bottom, target at Position.Top).
 *
 * We hand-roll the path string instead of calling `getBezierPath`
 * because that function lives in `@xyflow/react`; the domain layer
 * should not depend on a UI library. Phase B+ also needs to emit
 * composite paths with interior corners, which a hand-rolled builder
 * supports naturally.
 */
export const defaultBezierPath = (source: Point, target: Point): string => {
  // Control points at the vertical midpoint between source and target.
  // For source-above-target (target.y > source.y) this produces a
  // gentle downward arc; for source-below-target it's an upward arc.
  // Symmetric in either direction.
  const midY = (source.y + target.y) / 2;
  return (
    `M${source.x},${source.y} ` +
    `C${source.x},${midY} ` +
    `${target.x},${midY} ` +
    `${target.x},${target.y}`
  );
};

/**
 * Compose two cubic beziers through a single interior waypoint. The
 * first cubic goes source → waypoint with control points at their
 * shared vertical midpoint; the second cubic does waypoint → target
 * the same way. Continuity at the waypoint is C0 (the curve passes
 * through `waypoint` exactly) but not C1 (the tangents on either side
 * can disagree slightly). For Phase B the visual artefact is
 * acceptable; Phase C will compute C1-continuous joins.
 */
export const bezierThroughWaypoint = (source: Point, waypoint: Point, target: Point): string => {
  // Two sub-paths concatenated. Both use the vertical midpoint pattern
  // for their control points so the curve feels organic on each leg.
  const midY1 = (source.y + waypoint.y) / 2;
  const midY2 = (waypoint.y + target.y) / 2;
  return (
    `M${source.x},${source.y} ` +
    `C${source.x},${midY1} ${waypoint.x},${midY1} ${waypoint.x},${waypoint.y} ` +
    `C${waypoint.x},${midY2} ${target.x},${midY2} ${target.x},${target.y}`
  );
};

/**
 * Evaluate a cubic bezier at parameter t. The cubic is defined by
 * four control points — for the {@link defaultBezierPath} shape:
 *   P0 = source, P1 = (source.x, midY), P2 = (target.x, midY), P3 = target
 * Caller passes the bezier's parameter t in [0, 1].
 *
 * Used internally by {@link sampleDefaultBezier} to materialise the
 * polyline approximation used for hit-testing.
 */
const cubicBezierAt = (p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point => {
  const u = 1 - t;
  const w0 = u * u * u;
  const w1 = 3 * u * u * t;
  const w2 = 3 * u * t * t;
  const w3 = t * t * t;
  return {
    x: w0 * p0.x + w1 * p1.x + w2 * p2.x + w3 * p3.x,
    y: w0 * p0.y + w1 * p1.y + w2 * p2.y + w3 * p3.y,
  };
};

/**
 * Sample the default source→target bezier at {@link BEZIER_SAMPLE_COUNT}
 * evenly-spaced parameter values. Returns the point list (length =
 * BEZIER_SAMPLE_COUNT) including the endpoints so callers can pair-
 * iterate it into N−1 line segments for hit-testing.
 */
export const sampleDefaultBezier = (source: Point, target: Point): Point[] => {
  const midY = (source.y + target.y) / 2;
  const p1: Point = { x: source.x, y: midY };
  const p2: Point = { x: target.x, y: midY };
  const out: Point[] = [];
  for (let i = 0; i < BEZIER_SAMPLE_COUNT; i++) {
    const t = i / (BEZIER_SAMPLE_COUNT - 1);
    out.push(cubicBezierAt(source, p1, p2, target, t));
  }
  return out;
};

/**
 * Exact line-segment-vs-axis-aligned-box intersection test (Liang-
 * Barsky parametric clipping). Returns `true` when the segment from
 * `s` to `t` enters and exits the box's interior at some t ∈ [0, 1].
 * Endpoints touching the boundary count as intersection.
 *
 * This is the top-left+size sibling of
 * `radialEdgeRouting.lineIntersectsBox` — both modules implement the
 * same math; the difference is the box representation each one
 * consumes (top-left vs. centre+half-extents).
 */
export const segmentIntersectsBox = (s: Point, t: Point, box: Box): boolean => {
  const xmin = box.x;
  const xmax = box.x + box.width;
  const ymin = box.y;
  const ymax = box.y + box.height;
  const dx = t.x - s.x;
  const dy = t.y - s.y;
  let tEnter = 0;
  let tExit = 1;
  const ps = [-dx, dx, -dy, dy];
  const qs = [s.x - xmin, xmax - s.x, s.y - ymin, ymax - s.y];
  for (let i = 0; i < 4; i++) {
    const p = ps[i];
    const q = qs[i];
    if (p === undefined || q === undefined) continue;
    if (p === 0) {
      if (q < 0) return false;
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > tExit) return false;
        if (r > tEnter) tEnter = r;
      } else {
        if (r < tEnter) return false;
        if (r < tExit) tExit = r;
      }
    }
  }
  return tEnter <= tExit;
};

/** Pad a box uniformly by `margin` pixels on every side. */
const padBox = (box: Box, margin: number): Box => ({
  x: box.x - margin,
  y: box.y - margin,
  width: box.width + 2 * margin,
  height: box.height + 2 * margin,
});

/**
 * Find every obstacle whose padded bounding box is crossed by the
 * sampled bezier polyline between `source` and `target`. Returns the
 * boxes in their original (unpadded) form so callers can compute
 * detour offsets relative to the visible footprint.
 *
 * Exported for direct unit testing of the hit-test layer.
 */
export const findBlockingObstacles = (
  source: Point,
  target: Point,
  obstacles: readonly Box[],
  padding: number = OBSTACLE_PADDING
): Box[] => {
  if (obstacles.length === 0) return [];
  const samples = sampleDefaultBezier(source, target);
  const blockers: Box[] = [];
  for (const box of obstacles) {
    const padded = padBox(box, padding);
    let blocked = false;
    for (let i = 0; i < samples.length - 1; i++) {
      const a = samples[i];
      const b = samples[i + 1];
      if (a === undefined || b === undefined) continue;
      if (segmentIntersectsBox(a, b, padded)) {
        blocked = true;
        break;
      }
    }
    if (blocked) blockers.push(box);
  }
  return blockers;
};

/**
 * Pick the waypoint coordinates for a single-obstacle detour. The
 * waypoint sits horizontally above or below the obstacle (whichever
 * side requires the smaller vertical excursion from the source→target
 * midpoint) and horizontally at the obstacle's x-centre. The detour
 * clearance ({@link DETOUR_CLEARANCE}) is added on top of the
 * obstacle's padded extent so the bezier's curvature doesn't dip back
 * into the obstacle on the smoothed cubic.
 *
 * Exported for direct unit testing of the waypoint geometry.
 */
export const pickDetourWaypoint = (
  source: Point,
  target: Point,
  obstacle: Box,
  padding: number = OBSTACLE_PADDING
): Point => {
  const padded = padBox(obstacle, padding);
  const midY = (source.y + target.y) / 2;
  // Two candidate waypoints: directly above or directly below the
  // padded box, with extra clearance to keep the bezier curvature
  // from re-entering.
  const above: Point = {
    x: padded.x + padded.width / 2,
    y: padded.y - DETOUR_CLEARANCE,
  };
  const below: Point = {
    x: padded.x + padded.width / 2,
    y: padded.y + padded.height + DETOUR_CLEARANCE,
  };
  // Pick the side whose y is closer to the source→target midpoint —
  // the shorter detour visually. Equality goes to "above" arbitrarily
  // so the function is deterministic.
  const distAbove = Math.abs(above.y - midY);
  const distBelow = Math.abs(below.y - midY);
  return distBelow < distAbove ? below : above;
};

/**
 * Phase B implementation: route the edge by detecting obstacles on
 * the default bezier and detouring around a single blocker via a
 * smoothed two-cubic path through one waypoint. Multi-blocker cases
 * fall through to the Phase A bezier — Phase C's visibility graph +
 * A\* will handle those.
 *
 * The function is total (never throws) and pure (no side effects, no
 * store reads). Degenerate inputs:
 *   - `source === target`: emits a no-op `M sx,sy L sx,sy` so the SVG
 *     renderer doesn't choke. Real React Flow edges never hit this
 *     case (source and target are distinct nodes), but the guard
 *     keeps the function total.
 *   - empty obstacle list: behaves identically to Phase A — single
 *     cubic bezier from source to target.
 */
export const routeEdge = (input: RoutingInput): EdgeRoute => {
  const { source, target, obstacles, obstaclePadding = OBSTACLE_PADDING } = input;
  // Zero-length segment — emit a degenerate no-op path.
  if (source.x === target.x && source.y === target.y) {
    return {
      d: `M${source.x},${source.y} L${source.x},${source.y}`,
      waypoints: [source, target],
    };
  }
  const blockers = findBlockingObstacles(source, target, obstacles, obstaclePadding);
  // Phase B handles exactly the single-blocker case. Zero blockers →
  // default bezier (unchanged from Phase A). Two-plus blockers →
  // default bezier (deferred to Phase C). Both fallthrough branches
  // emit the same path because Phase B is "improve the trivial case";
  // Phase C is "handle the rest".
  if (blockers.length === 1) {
    const blocker = blockers[0];
    if (blocker) {
      const waypoint = pickDetourWaypoint(source, target, blocker, obstaclePadding);
      return {
        d: bezierThroughWaypoint(source, waypoint, target),
        waypoints: [source, waypoint, target],
      };
    }
  }
  return {
    d: defaultBezierPath(source, target),
    waypoints: [source, target],
  };
};
