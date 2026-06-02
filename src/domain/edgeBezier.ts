/**
 * Edge-routing bezier emitters — the SVG path builders + bezier samplers the
 * router uses to turn a waypoint list into a renderable curve, and to sample a
 * curve into a polyline for hit-testing.
 *
 * Split out of `edgeRouting.ts` (Session 164). Two families:
 *   - the legacy vertical-tangent emitters (`defaultBezierPath` +
 *     `bezierThroughWaypoint(s)`), kept byte-for-byte so existing snapshots
 *     are unchanged;
 *   - the side-aware siblings (`sideBezierSegment`, `bezierThroughWaypointsSided`,
 *     `sampleSidedBezier`) that leave each endpoint perpendicular to its chosen
 *     {@link Side}.
 *
 * Pure geometry — no store, no React. `Side` is a type-only import so this
 * module carries no runtime dependency on `edgeSides`.
 */

import type { Point } from './edgeGeometry';
import type { Side } from './edgeSides';

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

// -- Feature #5 — side-aware tangent emitters -----------------------------
//
// The default emitters above bake a VERTICAL tangent (control points at
// the vertical midpoint), which only looks right when the edge leaves the
// source bottom and enters the target top. Once `selectEdgeSides` can pick
// any of the four sides, the curve must leave each endpoint perpendicular
// to its chosen side — exactly what React Flow's own `getBezierPath` does.
// These siblings take a {@link Side} per endpoint and offset the control
// point along that side's outward normal. The legacy emitters are kept
// intact so existing callers / snapshots are byte-for-byte unchanged.

/** Unit outward normal for a box side. */
const sideNormal = (s: Side): Point =>
  s === 'top'
    ? { x: 0, y: -1 }
    : s === 'bottom'
      ? { x: 0, y: 1 }
      : s === 'left'
        ? { x: -1, y: 0 }
        : s === 'right'
          ? { x: 1, y: 0 }
          : // Exhaustiveness guard: if `Side` ever gains a member, this
            // `satisfies never` fails to compile rather than silently
            // returning the right-side normal.
            (s satisfies never);

/**
 * Control-point reach as a fraction of the run. 0.5 reproduces the
 * vertical-midpoint control points of {@link defaultBezierPath} exactly
 * for the (bottom → top) facing pair, so that case stays byte-identical.
 */
const BEZIER_CURVATURE = 0.5;

const controlOffset = (normal: Point, dx: number, dy: number): number =>
  (normal.y !== 0 ? dy : dx) * BEZIER_CURVATURE;

/**
 * A single cubic from `source` to `target` whose tangents leave each
 * endpoint perpendicular to its chosen side. For (bottom, top) with the
 * target below, this collapses to `defaultBezierPath`'s output.
 */
export const sideBezierSegment = (
  source: Point,
  sourceSide: Side,
  target: Point,
  targetSide: Side
): string => {
  const dx = Math.abs(target.x - source.x);
  const dy = Math.abs(target.y - source.y);
  const sn = sideNormal(sourceSide);
  const tn = sideNormal(targetSide);
  const sOff = controlOffset(sn, dx, dy);
  const tOff = controlOffset(tn, dx, dy);
  const c1x = source.x + sn.x * sOff;
  const c1y = source.y + sn.y * sOff;
  const c2x = target.x + tn.x * tOff;
  const c2y = target.y + tn.y * tOff;
  return `M${source.x},${source.y} C${c1x},${c1y} ${c2x},${c2y} ${target.x},${target.y}`;
};

/**
 * Multi-waypoint variant. Only the first and last cubics are side-aware
 * (they touch a node); every interior cubic keeps the vertical-midpoint
 * control points of {@link bezierThroughWaypoints}, byte-for-byte, so
 * interior route shapes are unchanged. Input includes source as
 * `points[0]` and target as the last entry.
 */
export const bezierThroughWaypointsSided = (
  points: readonly Point[],
  sourceSide: Side,
  targetSide: Side
): string => {
  if (points.length < 2) {
    throw new Error(`bezierThroughWaypointsSided requires at least 2 points, got ${points.length}`);
  }
  if (points.length === 2) {
    const [p0, p1] = points as readonly [Point, Point, ...Point[]];
    return sideBezierSegment(p0, sourceSide, p1, targetSide);
  }
  const n = points.length;
  let path = `M${points[0]?.x},${points[0]?.y}`;
  for (let i = 0; i < n - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (!a || !b) continue;
    const midY = (a.y + b.y) / 2;
    // Interior default: vertical-midpoint controls (identical to the
    // legacy emitter). First/last legs override the touching control.
    let c1x = a.x;
    let c1y = midY;
    let c2x = b.x;
    let c2y = midY;
    if (i === 0) {
      const sn = sideNormal(sourceSide);
      const off = controlOffset(sn, Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      c1x = a.x + sn.x * off;
      c1y = a.y + sn.y * off;
    }
    if (i === n - 2) {
      const tn = sideNormal(targetSide);
      const off = controlOffset(tn, Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      c2x = b.x + tn.x * off;
      c2y = b.y + tn.y * off;
    }
    path += ` C${c1x},${c1y} ${c2x},${c2y} ${b.x},${b.y}`;
  }
  return path;
};

/**
 * Side-aware sibling of {@link sampleDefaultBezier} — samples the cubic
 * that {@link sideBezierSegment} draws, so the curvature-dip hit-test
 * stays correct for horizontal anchors.
 */
export const sampleSidedBezier = (
  source: Point,
  sourceSide: Side,
  target: Point,
  targetSide: Side
): Point[] => {
  const dx = Math.abs(target.x - source.x);
  const dy = Math.abs(target.y - source.y);
  const sn = sideNormal(sourceSide);
  const tn = sideNormal(targetSide);
  const p1: Point = {
    x: source.x + sn.x * controlOffset(sn, dx, dy),
    y: source.y + sn.y * controlOffset(sn, dx, dy),
  };
  const p2: Point = {
    x: target.x + tn.x * controlOffset(tn, dx, dy),
    y: target.y + tn.y * controlOffset(tn, dx, dy),
  };
  const out: Point[] = [];
  for (let i = 0; i < BEZIER_SAMPLE_COUNT; i++) {
    const t = i / (BEZIER_SAMPLE_COUNT - 1);
    out.push(cubicBezierAt(source, p1, p2, target, t));
  }
  return out;
};
