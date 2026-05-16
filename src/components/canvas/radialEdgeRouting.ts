/**
 * Session 99 — Obstacle-aware edge routing for the radial layout.
 *
 * The radial / sunburst layout (`src/domain/radialLayout.ts`) places
 * nodes on concentric rings. Edges drawn between rings via React
 * Flow's default `getBezierPath` often pass straight through cousin
 * or sibling node boxes — readable on a small tree, increasingly
 * cluttered as the graph grows. The dagre flow layout doesn't have
 * this problem because dagre orients its output so connected nodes
 * sit on adjacent ranks; radial trades that for the radial geometry.
 *
 * This module is the pure-geometry layer. It takes:
 *   - a source point + target point (in flow coordinates),
 *   - a list of "obstacle" node bounding boxes (the OTHER visible
 *     nodes; the source and target are filtered out by the caller),
 *
 * and returns an SVG path string + label position. The path is a
 * cubic Bézier — same family as React Flow's default — but with
 * control points deflected perpendicular to the source-target axis
 * whenever the straight-line segment would pass through an obstacle
 * box.
 *
 * Trade-offs:
 *   - **No A\* / orthogonal routing.** A single perpendicular
 *     deflection handles ~80% of real radial-tree edges (the case
 *     where one sibling sits roughly between the source and target).
 *     Pathological multi-obstacle layouts still cross — they're rare
 *     in TOC diagrams and the cost of a full router (graph search,
 *     orthogonal segments, junction joining) is not warranted.
 *   - **No memoization here.** This module is called per edge, per
 *     render in radial mode. The TPEdge caller wraps it in a
 *     `useMemo` keyed on positions; this stays a pure function so
 *     it's directly unit-testable.
 *   - **Box geometry is axis-aligned.** The nodes are rectangles
 *     positioned in flow coordinates; obstacle boxes are passed as
 *     `{ x, y, halfW, halfH }` where `(x, y)` is the box CENTER.
 *     Callers compute this once from the node's top-left + size.
 *
 * The Liang-Barsky parametric line-clip test is exact for axis-
 * aligned rectangles and runs in constant time per box.
 */

/** A point in flow coordinates (pre-viewport-transform). */
export type Point = { readonly x: number; readonly y: number };

/** An axis-aligned box centered at `(x, y)` with half-extents
 *  `halfW` and `halfH`. The center-based representation matches what
 *  the obstacle-collection code computes from `nodeInternals` (each
 *  node's `position` is top-left; the helper adds half the width /
 *  height to land on center). */
export type Box = {
  readonly x: number;
  readonly y: number;
  readonly halfW: number;
  readonly halfH: number;
};

/** The output of {@link computeRadialEdgePath} — drop-in compatible
 *  with React Flow's `getBezierPath` tuple shape, plus a `deflected`
 *  flag the caller can use to visually distinguish routed edges
 *  (currently unused; kept for future visual debug). */
export type RadialEdgeRoute = {
  /** SVG path string ready for `<path d>`. */
  readonly path: string;
  /** Label centroid X (flow coordinates) — used by EdgeLabelRenderer. */
  readonly labelX: number;
  /** Label centroid Y (flow coordinates). */
  readonly labelY: number;
  /** True when the path was deflected to avoid one or more obstacles.
   *  False when the straight bezier between source and target passes
   *  through nothing. */
  readonly deflected: boolean;
};

export type RoutingOptions = {
  /** Extra clearance (px) past the obstacle's half-diagonal when
   *  deflecting. Larger values produce more dramatic curves; smaller
   *  values hug the obstacle. Default 16 — roughly the height of an
   *  edge label, so the curve clears the label band too. */
  readonly margin?: number;
  /** Bézier control-point distance along the source→target axis,
   *  as a fraction of the segment length. The default of 0.3 places
   *  the control points 30% of the way in from each endpoint, which
   *  matches the visual feel of React Flow's `getBezierPath` for
   *  short edges and avoids the overshoot of larger values. */
  readonly alpha?: number;
};

/**
 * Exact line-segment-vs-axis-aligned-box intersection test
 * (Liang-Barsky parametric clipping). Returns `true` when the
 * segment from `s` to `t` enters and exits the box's interior at
 * some `t \in [0, 1]`. Endpoints touching the boundary count as
 * intersection so that an edge starting / ending flush against the
 * box still triggers the avoid path.
 *
 * Pulled out as its own export so the unit tests can pin the math
 * independently of the higher-level routing logic.
 */
export const lineIntersectsBox = (s: Point, t: Point, box: Box): boolean => {
  const xmin = box.x - box.halfW;
  const xmax = box.x + box.halfW;
  const ymin = box.y - box.halfH;
  const ymax = box.y + box.halfH;

  const dx = t.x - s.x;
  const dy = t.y - s.y;

  // For each of the four box edges we compute the parametric `t` at
  // which the line crosses it. The segment is inside the box for
  // `t \in [tEnter, tExit]`; the segment hits the box iff
  // `tEnter <= tExit AND [tEnter, tExit]` overlaps `[0, 1]`.
  let tEnter = 0;
  let tExit = 1;
  const ps = [-dx, dx, -dy, dy];
  const qs = [s.x - xmin, xmax - s.x, s.y - ymin, ymax - s.y];

  for (let i = 0; i < 4; i++) {
    const p = ps[i];
    const q = qs[i];
    // Type narrowing — `ps` and `qs` are length-4 tuples but TS sees
    // them as `number[]`; assert non-null since we know `i < 4`.
    if (p === undefined || q === undefined) continue;
    if (p === 0) {
      // Line parallel to this edge — outside iff q < 0.
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
 * Compute a routed edge path between `source` and `target` that
 * avoids the provided obstacles where possible.
 *
 * Algorithm:
 *   1. For each obstacle box, run the Liang-Barsky test against the
 *      straight source→target segment. If the segment doesn't
 *      intersect the box, the box is ignored.
 *   2. For each intersecting box, compute a perpendicular deflection
 *      vector: the magnitude is the box's half-diagonal + `margin`,
 *      and the sign points away from the box's center. Multiple hits
 *      average their deflections (so a clump of obstacles pushes
 *      proportionally harder than a single one).
 *   3. Build a symmetric cubic Bézier:
 *        P0 = source
 *        P1 = source + alpha · (target − source) + deflection
 *        P2 = target − alpha · (target − source) + deflection
 *        P3 = target
 *      For deflection = 0 this reduces to a nearly-straight curve
 *      with mild round-out at the endpoints (matches React Flow's
 *      default feel). For non-zero deflection it produces a smooth
 *      arc that bulges away from the obstacle cluster.
 *   4. The label position is the curve's geometric midpoint, which
 *      for this symmetric form is `(s + t)/2 + 0.75 · deflection`.
 *
 * Degenerate inputs:
 *   - `source === target` (zero-length segment): emits `M sx,sy
 *     L sx,sy` so React Flow's `<BaseEdge>` renders nothing
 *     pathological; label sits at the source.
 *   - Empty obstacle list: returns a straight-ish bezier with
 *     `deflected: false` — same shape as the no-hit case in the
 *     loop above.
 */
export const computeRadialEdgePath = (
  source: Point,
  target: Point,
  obstacles: readonly Box[],
  options: RoutingOptions = {}
): RadialEdgeRoute => {
  const margin = options.margin ?? 16;
  const alpha = options.alpha ?? 0.3;

  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const len = Math.hypot(dx, dy);

  // Degenerate zero-length segment — emit a no-op path so the SVG
  // renderer doesn't choke. Real React Flow edges never hit this
  // (source and target are distinct nodes), but it keeps the
  // function total.
  if (len === 0) {
    return {
      path: `M${source.x},${source.y} L${source.x},${source.y}`,
      labelX: source.x,
      labelY: source.y,
      deflected: false,
    };
  }

  const midX = (source.x + target.x) / 2;
  const midY = (source.y + target.y) / 2;

  // Unit perpendicular (rotated 90° counter-clockwise from the
  // source→target axis). Used both for the deflection direction
  // and for the sign test against each obstacle's center.
  const perpX = -dy / len;
  const perpY = dx / len;

  let totalDeflection = 0;
  let hits = 0;
  for (const box of obstacles) {
    if (!lineIntersectsBox(source, target, box)) continue;
    // Project the vector (box.center − midpoint) onto the
    // perpendicular axis. The sign tells us which side of the
    // source→target line the obstacle sits on; we deflect to the
    // OTHER side.
    const toBoxX = box.x - midX;
    const toBoxY = box.y - midY;
    const projection = toBoxX * perpX + toBoxY * perpY;
    const sign = projection > 0 ? -1 : 1;
    // Clearance distance: the worst-case extent of the obstacle
    // along the perpendicular axis is its half-diagonal. Add the
    // margin so the curve clears the box with room for the stroke
    // + label band.
    const clearance = Math.hypot(box.halfW, box.halfH) + margin;
    totalDeflection += sign * clearance;
    hits += 1;
  }

  // Symmetric cubic. When `cpDeflection` is 0, the path reads as a
  // mild s-curve close to a straight line; when nonzero, the curve
  // bulges by ~0.75 × cpDeflection at its midpoint (verified by
  // unit-testing the cubic Bézier at t=0.5: B(0.5) = (P0 + 3P1 +
  // 3P2 + P3)/8 = (s+t)/2 + 0.75 · cpDeflection · perp).
  const cpDeflection = hits === 0 ? 0 : totalDeflection / hits;

  const p1x = source.x + alpha * dx + cpDeflection * perpX;
  const p1y = source.y + alpha * dy + cpDeflection * perpY;
  const p2x = target.x - alpha * dx + cpDeflection * perpX;
  const p2y = target.y - alpha * dy + cpDeflection * perpY;

  const path = `M${source.x},${source.y} C${p1x},${p1y} ${p2x},${p2y} ${target.x},${target.y}`;

  return {
    path,
    labelX: midX + 0.75 * cpDeflection * perpX,
    labelY: midY + 0.75 * cpDeflection * perpY,
    deflected: hits > 0,
  };
};

/**
 * Convenience constructor: turn a node's top-left position +
 * width / height into a {@link Box} (center + half-extents).
 *
 * Pulled into a helper so the TPEdge caller's obstacle-collection
 * loop reads cleanly. The radial layout returns top-left positions
 * (matching dagre's convention); React Flow stores the same shape
 * internally.
 */
export const nodeBoxOf = (position: Point, width: number, height: number): Box => ({
  x: position.x + width / 2,
  y: position.y + height / 2,
  halfW: width / 2,
  halfH: height / 2,
});
