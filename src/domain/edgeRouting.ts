/**
 * Edge routing module — obstacle-aware path finding for the dagre / flow
 * layout. See `docs/EDGE_ROUTING_PROPOSAL.md` for the full design.
 *
 * Phasing on main:
 *   - **Phase A** (shipped): API contract + types + no-op `routeEdge`
 *     returning a bezier verbatim.
 *   - **Phase B** (shipped): single-obstacle deflection heuristic.
 *     Bezier-sample hit-test against axis-aligned boxes; when exactly
 *     one obstacle blocks the curve, emit a smoothed two-cubic path
 *     through a waypoint placed above or below the obstacle (shorter
 *     side wins).
 *   - **Phase C** (this revision): visibility-graph + A\* router for
 *     the multi-obstacle case. Builds a graph whose vertices are the
 *     source, target, and each obstacle's four padded corners; edges
 *     connect any vertex pair whose connecting segment doesn't hit
 *     an obstacle's interior. A\* with euclidean heuristic finds the
 *     shortest obstacle-free path; the corner list emits as a multi-
 *     cubic bezier through the waypoint sequence.
 *   - **Phase D** (planned): junctor segment integration + WeakMap
 *     route cache + USER_GUIDE + CHANGELOG.
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
 * dagre routing uses the visibility-graph + A\* approach here because
 * dagre layouts are flow-rank-oriented and routinely produce multi-
 * obstacle crossings that a single perpendicular deflection can't fix.
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
 * `rankSpacing` is reserved for future use (multi-rank waypoint
 * placement); currently unused.
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
 * adds a single interior corner for the single-blocker case; Phase C
 * populates richer corner lists from the A\* search.
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
 * obstacle's nearest edge in the Phase B single-obstacle heuristic.
 * Larger values produce more dramatic curves that read clearly as
 * "going around"; smaller values hug the obstacle more tightly.
 * 16 px matches the visual feel of the radial router's deflection
 * margin.
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
 * should not depend on a UI library. The hand-rolled builder also
 * makes the composite multi-waypoint path emission trivial.
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
 * can disagree slightly). The visual artefact is acceptable.
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
 * Compose N cubic beziers through an arbitrary waypoint list. The
 * input includes the source as `points[0]` and the target as the
 * last entry; every consecutive pair becomes one cubic segment with
 * vertical-midpoint control points. C0 continuity at each waypoint;
 * the joins are smooth enough for the visual identity the proposal
 * locks in ("organic / hand-drawn"). Phase C uses this on visibility-
 * graph A\* output, which can return 2-6 waypoints for typical dense
 * diagrams.
 *
 * Special cases:
 *   - 2 points (source → target only): emits the same path as
 *     `defaultBezierPath`.
 *   - 1 or 0 points: throws — caller error. Real routing always
 *     produces at least two endpoints.
 */
export const bezierThroughWaypoints = (points: readonly Point[]): string => {
  if (points.length < 2) {
    throw new Error(`bezierThroughWaypoints requires at least 2 points, got ${points.length}`);
  }
  if (points.length === 2) {
    const [p0, p1] = points as readonly [Point, Point, ...Point[]];
    return defaultBezierPath(p0, p1);
  }
  let path = `M${points[0]?.x},${points[0]?.y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (!a || !b) continue;
    const midY = (a.y + b.y) / 2;
    path += ` C${a.x},${midY} ${b.x},${midY} ${b.x},${b.y}`;
  }
  return path;
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

/**
 * Strict-interior segment-vs-box test, inlined for the visibility-
 * graph hot path. Operates on flat `xmin/xmax/ymin/ymax` numbers
 * rather than `Box` objects so the inner A\* loop doesn't allocate
 * per call — that single change moves us from ~500 ms to <50 ms on
 * a 50-edge × 50-obstacle benchmark.
 *
 * Logical equivalent of {@link segmentIntersectsBox} on a box shrunk
 * by EPS on every side. Corner-on-padded-boundary cases pass through
 * (the EPS shrink keeps corner→corner edges along a shared boundary
 * visible to each other).
 */
const segmentCrossesBoxBounds = (
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  xmin: number,
  xmax: number,
  ymin: number,
  ymax: number
): boolean => {
  if (xmax <= xmin || ymax <= ymin) return false;
  const dx = tx - sx;
  const dy = ty - sy;
  let tEnter = 0;
  let tExit = 1;
  // Iteration unrolled — V8 doesn't auto-unroll a 4-iter loop here and
  // the inner branch is hot enough that the saved loop overhead is
  // measurable on the 50-obstacle benchmark.
  {
    const p = -dx;
    const q = sx - xmin;
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
  {
    const p = dx;
    const q = xmax - sx;
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
  {
    const p = -dy;
    const q = sy - ymin;
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
  {
    const p = dy;
    const q = ymax - sy;
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

// -- Phase C — visibility graph + A\* -------------------------------------
//
// Phase D refactor: the visibility graph is now a reusable
// {@link VisibilityGraph} value that callers can build once per
// layout pass and run A\* against per-edge. This brings the per-edge
// cost from O(n² m) (full rebuild) down to O(n) for the source/target
// extension + O(n² + n log n) for A\*, which is what the proposal's
// 50-edge ≤ 5 ms target assumes.

/**
 * Reusable visibility-graph value. Vertices are the obstacle corners
 * (4 per obstacle), stored as parallel `Float64Array`s for cache-
 * friendly access; the adjacency lists are flat-array per-vertex.
 *
 * Construct once via {@link buildVisibilityGraph} and call
 * {@link aStarOnGraph} per edge to find the shortest path between
 * arbitrary source/target points.
 *
 * The flat-array representation deliberately exposes the storage
 * format — Phase D's per-layout cache reuses the same graph across
 * many A\* calls and shaving allocations on each path lookup matters.
 */
export type VisibilityGraph = {
  /** Total number of corner vertices in the graph. = 4 × obstacles.length. */
  readonly cornerCount: number;
  /** Corner x-coordinates, indexed 0…cornerCount-1. */
  readonly vx: Float64Array;
  /** Corner y-coordinates, indexed 0…cornerCount-1. */
  readonly vy: Float64Array;
  /** Per-corner adjacency: `adjIdx[i]` is the list of neighbor corner indices. */
  readonly adjIdx: readonly number[][];
  /** Per-corner adjacency edge weights matching {@link adjIdx}. */
  readonly adjW: readonly number[][];
  /** Shrunk-interior obstacle x-mins, used for visibility checks involving the source/target. */
  readonly oxmin: Float64Array;
  /** Shrunk-interior obstacle x-maxes. */
  readonly oxmax: Float64Array;
  /** Shrunk-interior obstacle y-mins. */
  readonly oymin: Float64Array;
  /** Shrunk-interior obstacle y-maxes. */
  readonly oymax: Float64Array;
  /** Obstacle count (= oxmin.length, etc.). */
  readonly obstacleCount: number;
};

/** Visibility check on flat arrays. Pulled out as a top-level helper
 *  so both graph construction and A\* extension can call it. The
 *  `excludeIdx0` / `excludeIdx1` parameters skip up to two specific
 *  obstacle indices — used in `aStarOnGraph` to exempt the source /
 *  target nodes' own boxes, since their handle positions sit inside
 *  the shrunk-interior bounds. Pass `-1` for unused exclude slots. */
const segmentVisible = (
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  oxmin: Float64Array,
  oxmax: Float64Array,
  oymin: Float64Array,
  oymax: Float64Array,
  m: number,
  excludeIdx0: number = -1,
  excludeIdx1: number = -1
): boolean => {
  for (let k = 0; k < m; k++) {
    if (k === excludeIdx0 || k === excludeIdx1) continue;
    if (
      segmentCrossesBoxBounds(
        sx,
        sy,
        tx,
        ty,
        oxmin[k] ?? 0,
        oxmax[k] ?? 0,
        oymin[k] ?? 0,
        oymax[k] ?? 0
      )
    ) {
      return false;
    }
  }
  return true;
};

/**
 * Build a {@link VisibilityGraph} from an obstacle list. The corners
 * of each obstacle are nudged outward by `padding`; pairs of corners
 * whose connecting segment doesn't cross any obstacle's shrunk
 * interior become graph edges with their euclidean distance as weight.
 *
 * Phase D — exported so `computeEdgeRoutes` can build the graph once
 * per layout pass and reuse it across many A\* calls. The expensive
 * O(n² m) work happens here; per-edge A\* is then cheap.
 */
export const buildVisibilityGraph = (
  obstacles: readonly Box[],
  padding: number = OBSTACLE_PADDING
): VisibilityGraph => {
  const m = obstacles.length;
  const cornerCount = m * 4;
  const vx = new Float64Array(cornerCount);
  const vy = new Float64Array(cornerCount);
  for (let i = 0; i < m; i++) {
    const o = obstacles[i];
    if (!o) continue;
    const left = o.x - padding;
    const right = o.x + o.width + padding;
    const top = o.y - padding;
    const bottom = o.y + o.height + padding;
    const base = i * 4;
    vx[base] = left;
    vy[base] = top;
    vx[base + 1] = right;
    vy[base + 1] = top;
    vx[base + 2] = left;
    vy[base + 2] = bottom;
    vx[base + 3] = right;
    vy[base + 3] = bottom;
  }
  // Shrunk-interior obstacle bounds for the visibility check. EPS
  // keeps corner-corner edges along a shared boundary visible.
  const EPS = 0.001;
  const oxmin = new Float64Array(m);
  const oxmax = new Float64Array(m);
  const oymin = new Float64Array(m);
  const oymax = new Float64Array(m);
  for (let i = 0; i < m; i++) {
    const o = obstacles[i];
    if (!o) continue;
    oxmin[i] = o.x - padding + EPS;
    oxmax[i] = o.x + o.width + padding - EPS;
    oymin[i] = o.y - padding + EPS;
    oymax[i] = o.y + o.height + padding - EPS;
  }
  // Adjacency build — O(n² m) once.
  const adjIdx: number[][] = new Array(cornerCount);
  const adjW: number[][] = new Array(cornerCount);
  for (let i = 0; i < cornerCount; i++) {
    adjIdx[i] = [];
    adjW[i] = [];
  }
  for (let i = 0; i < cornerCount; i++) {
    const sx = vx[i] ?? 0;
    const sy = vy[i] ?? 0;
    for (let j = i + 1; j < cornerCount; j++) {
      const tx = vx[j] ?? 0;
      const ty = vy[j] ?? 0;
      if (!segmentVisible(sx, sy, tx, ty, oxmin, oxmax, oymin, oymax, m)) continue;
      const w = Math.hypot(tx - sx, ty - sy);
      adjIdx[i]?.push(j);
      adjW[i]?.push(w);
      adjIdx[j]?.push(i);
      adjW[j]?.push(w);
    }
  }
  return { cornerCount, vx, vy, adjIdx, adjW, oxmin, oxmax, oymin, oymax, obstacleCount: m };
};

/**
 * Run A\* through a pre-built {@link VisibilityGraph} from `source`
 * to `target`. The graph carries only the obstacle corners; the
 * source and target are added on top as transient vertices, and
 * their visibility to each corner is checked on the fly. The A\*
 * heuristic is straight-line euclidean distance.
 *
 * Returns the shortest obstacle-free corner sequence (including
 * source as the first element and target as the last) or `null` if
 * no path exists.
 */
export const aStarOnGraph = (
  graph: VisibilityGraph,
  source: Point,
  target: Point,
  /**
   * Optional obstacle indices to skip in visibility checks. The
   * caller passes the indices of the source / target node's own
   * boxes — the handle positions sit on those boxes' boundaries
   * (= inside the shrunk-interior), so without this skip the source
   * couldn't see any corner outside its own box and A\* would fail.
   * Pass `-1` for unused slots; two slots is enough for typical
   * source+target exclusion.
   */
  excludeSourceBox: number = -1,
  excludeTargetBox: number = -1
): Point[] | null => {
  const cornerCount = graph.cornerCount;
  const m = graph.obstacleCount;
  // Vertex layout: [source, target, corner_0, corner_1, ...]
  const vertexCount = 2 + cornerCount;
  const SOURCE_IDX = 0;
  const TARGET_IDX = 1;

  // Reusable per-vertex coordinate accessors — source/target inlined,
  // corners via the graph's flat arrays.
  const getVx = (idx: number): number =>
    idx === SOURCE_IDX ? source.x : idx === TARGET_IDX ? target.x : (graph.vx[idx - 2] ?? 0);
  const getVy = (idx: number): number =>
    idx === SOURCE_IDX ? source.y : idx === TARGET_IDX ? target.y : (graph.vy[idx - 2] ?? 0);

  // Visibility between source/target and every corner. We don't add
  // these into the graph (would mutate the shared cache); instead
  // we keep two side arrays.
  const sourceToCornerW = new Float64Array(cornerCount);
  const targetToCornerW = new Float64Array(cornerCount);
  for (let k = 0; k < cornerCount; k++) {
    sourceToCornerW[k] = Number.POSITIVE_INFINITY;
    targetToCornerW[k] = Number.POSITIVE_INFINITY;
  }
  for (let k = 0; k < cornerCount; k++) {
    const cx = graph.vx[k] ?? 0;
    const cy = graph.vy[k] ?? 0;
    if (
      segmentVisible(
        source.x,
        source.y,
        cx,
        cy,
        graph.oxmin,
        graph.oxmax,
        graph.oymin,
        graph.oymax,
        m,
        excludeSourceBox,
        excludeTargetBox
      )
    ) {
      sourceToCornerW[k] = Math.hypot(cx - source.x, cy - source.y);
    }
    if (
      segmentVisible(
        target.x,
        target.y,
        cx,
        cy,
        graph.oxmin,
        graph.oxmax,
        graph.oymin,
        graph.oymax,
        m,
        excludeSourceBox,
        excludeTargetBox
      )
    ) {
      targetToCornerW[k] = Math.hypot(cx - target.x, cy - target.y);
    }
  }
  // Source→target direct visibility.
  const sourceToTargetW = segmentVisible(
    source.x,
    source.y,
    target.x,
    target.y,
    graph.oxmin,
    graph.oxmax,
    graph.oymin,
    graph.oymax,
    m,
    excludeSourceBox,
    excludeTargetBox
  )
    ? Math.hypot(target.x - source.x, target.y - source.y)
    : Number.POSITIVE_INFINITY;

  const gScore = new Float64Array(vertexCount);
  const fScore = new Float64Array(vertexCount);
  for (let i = 0; i < vertexCount; i++) {
    gScore[i] = Number.POSITIVE_INFINITY;
    fScore[i] = Number.POSITIVE_INFINITY;
  }
  const cameFrom = new Int32Array(vertexCount).fill(-1);
  gScore[SOURCE_IDX] = 0;
  fScore[SOURCE_IDX] = Math.hypot(target.x - source.x, target.y - source.y);
  const open = new Set<number>([SOURCE_IDX]);

  // Returns the iterator over (neighborIdx, weight) for vertex `v`.
  // For the source / target we splice in the side arrays + the
  // direct source-target edge; for corners we read from the graph.
  const iterateNeighbors = (
    v: number,
    visit: (neighborIdx: number, weight: number) => void
  ): void => {
    if (v === SOURCE_IDX) {
      for (let k = 0; k < cornerCount; k++) {
        const w = sourceToCornerW[k] ?? Number.POSITIVE_INFINITY;
        if (Number.isFinite(w)) visit(2 + k, w);
      }
      if (Number.isFinite(sourceToTargetW)) visit(TARGET_IDX, sourceToTargetW);
      return;
    }
    if (v === TARGET_IDX) {
      for (let k = 0; k < cornerCount; k++) {
        const w = targetToCornerW[k] ?? Number.POSITIVE_INFINITY;
        if (Number.isFinite(w)) visit(2 + k, w);
      }
      if (Number.isFinite(sourceToTargetW)) visit(SOURCE_IDX, sourceToTargetW);
      return;
    }
    // Corner vertex.
    const cornerIdx = v - 2;
    const neighbors = graph.adjIdx[cornerIdx];
    const weights = graph.adjW[cornerIdx];
    if (neighbors && weights) {
      for (let i = 0; i < neighbors.length; i++) {
        const ni = neighbors[i];
        const w = weights[i];
        if (ni !== undefined && w !== undefined) visit(2 + ni, w);
      }
    }
    // Plus the back-edges to source/target if reachable.
    const wToSource = sourceToCornerW[cornerIdx] ?? Number.POSITIVE_INFINITY;
    if (Number.isFinite(wToSource)) visit(SOURCE_IDX, wToSource);
    const wToTarget = targetToCornerW[cornerIdx] ?? Number.POSITIVE_INFINITY;
    if (Number.isFinite(wToTarget)) visit(TARGET_IDX, wToTarget);
  };

  while (open.size > 0) {
    let best = -1;
    let bestF = Number.POSITIVE_INFINITY;
    for (const idx of open) {
      const f = fScore[idx] ?? Number.POSITIVE_INFINITY;
      if (f < bestF) {
        bestF = f;
        best = idx;
      }
    }
    if (best === -1) break;
    if (best === TARGET_IDX) {
      // Reconstruct the path.
      const path: Point[] = [];
      let cursor: number = best;
      while (cursor !== -1) {
        path.push({ x: getVx(cursor), y: getVy(cursor) });
        cursor = cameFrom[cursor] ?? -1;
      }
      path.reverse();
      return path;
    }
    open.delete(best);
    const gBest = gScore[best] ?? Number.POSITIVE_INFINITY;
    iterateNeighbors(best, (neighborIdx, weight) => {
      const tentativeG = gBest + weight;
      const currentG = gScore[neighborIdx] ?? Number.POSITIVE_INFINITY;
      if (tentativeG < currentG) {
        cameFrom[neighborIdx] = best;
        gScore[neighborIdx] = tentativeG;
        fScore[neighborIdx] =
          tentativeG + Math.hypot(target.x - getVx(neighborIdx), target.y - getVy(neighborIdx));
        if (!open.has(neighborIdx)) open.add(neighborIdx);
      }
    });
  }
  return null;
};

/**
 * Convenience wrapper — builds a fresh graph and runs A\* on it. Used
 * by single-edge callers (e.g. tests, the `routeEdge` shortcut path)
 * that don't need the caching benefit.
 *
 * For multi-edge layouts, prefer {@link buildVisibilityGraph} +
 * {@link aStarOnGraph} so the O(n²m) graph construction amortises
 * across edges.
 */
export const findVisibilityPath = (
  source: Point,
  target: Point,
  obstacles: readonly Box[],
  padding: number = OBSTACLE_PADDING
): Point[] | null => {
  const graph = buildVisibilityGraph(obstacles, padding);
  return aStarOnGraph(graph, source, target);
};

/**
 * Phase C implementation: route the edge using visibility-graph + A\*
 * over obstacle corners. Falls back to the default bezier when no
 * obstacle is on the path or when A\* fails (source/target inside an
 * obstacle).
 *
 * The function is total (never throws) and pure (no side effects, no
 * store reads). Degenerate inputs:
 *   - `source === target`: emits a no-op `M sx,sy L sx,sy`.
 *   - empty obstacle list: default cubic bezier from source to target.
 *   - no blockers on the default bezier: also default cubic bezier
 *     (skip the A\* cost when the straight bezier is already free).
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
  if (blockers.length === 0) {
    // Fast path — straight bezier is already obstacle-free, no need
    // to pay for A\*.
    return {
      d: defaultBezierPath(source, target),
      waypoints: [source, target],
    };
  }
  // Run the full visibility-graph A\* against the COMPLETE obstacle
  // set (not just the blockers). The A\* must see every obstacle so
  // its candidate waypoints don't accidentally cut through a non-
  // blocking sibling.
  const path = findVisibilityPath(source, target, obstacles, obstaclePadding);
  if (!path || path.length < 2) {
    // A\* couldn't find a route — fall back to the bezier so the edge
    // still renders (better than no edge at all).
    return {
      d: defaultBezierPath(source, target),
      waypoints: [source, target],
    };
  }
  if (path.length === 2) {
    // A\* found a direct line — same as the default bezier.
    return {
      d: defaultBezierPath(source, target),
      waypoints: [source, target],
    };
  }
  return {
    d: bezierThroughWaypoints(path),
    waypoints: path,
  };
};
