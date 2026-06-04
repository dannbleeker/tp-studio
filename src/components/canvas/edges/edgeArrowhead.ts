/**
 * The cause→effect arrowhead — single source of truth for its geometry,
 * tuning constants, and the emission↔render id tags.
 *
 * **Why a custom `<path>` and not React Flow's SVG `markerEnd`:** a `markerEnd`
 * marker always orients to the path's ENDPOINT tangent — the target handle's
 * fixed normal (vertical for a `Position.Bottom` handle). But the routed/bezier
 * edge approaches the box *diagonally*, so a marker pointed the wrong way and
 * (when offset for clearance) tucked under the card. `TPEdge` instead renders
 * the arrowhead itself as a `<path>`.
 *
 * **Orientation follows the actual curve, not the straight chord.** The edge is
 * a bezier (routed or default), so on a bent / converging edge the straight
 * source→target chord diverges from where the line actually meets the card — an
 * arrowhead placed on the chord floats *beside* the stroke. {@link arrowheadOnPath}
 * reads the rendered path's terminal tangent (its last cubic's `end − c2`) and
 * sits the arrowhead on that, so the tip is on the line as it enters the box.
 * {@link arrowheadPlacement} (the straight-chord version) stays as the fallback
 * for a path with no parseable cubic, and is pinned directly by the unit tests.
 *
 * The AND/OR/XOR junction's output arrow is a *separate* `<marker>` in
 * `JunctorOverlay` — that one rides a STRAIGHT `<line>`, where a marker orients
 * correctly, so it doesn't need this treatment.
 *
 * **Tuning the arrowhead is a one-line change here:** size (`ARROW_LENGTH` /
 * `ARROW_HALF_WIDTH`), how far the tip sits before the box (`ARROW_TIP_GAP`),
 * or the silhouette (`ARROW_TRIANGLE_D`).
 */

/**
 * Tags stamped onto a non-junctor edge's `markerEnd` by `useGraphEdgeEmission`
 * and read by `TPEdge` purely as a "this edge gets an arrowhead" signal (the
 * `_AND_` variant marks an aggregated junctor edge). They no longer reference
 * any rendered `<marker>` — the arrowhead is the custom `<path>` below — but
 * stay as the stable emission↔render contract (and the emission unit tests pin
 * them).
 */
export const EDGE_ARROW_MARKER_ID = 'tp-edge-arrow';
export const EDGE_ARROW_AND_MARKER_ID = 'tp-edge-arrow-and';

/** Triangle length, tip → base, in canvas units. */
export const ARROW_LENGTH = 15;
/** Half the triangle's base width, in canvas units. */
export const ARROW_HALF_WIDTH = 8;
/** How far before the target the tip sits, so the stroke runs out of it.
 *  11 → 6 — Dann's review: arrows should sit closer to the entity. */
export const ARROW_TIP_GAP = 6;

/**
 * The arrowhead silhouette, tip at the local origin and base `ARROW_LENGTH`
 * back along −x. `arrowheadTransform` rotates +x onto the edge direction, so
 * the tip ends up pointing at the target.
 */
export const ARROW_TRIANGLE_D = `M 0 0 L ${-ARROW_LENGTH} ${-ARROW_HALF_WIDTH} L ${-ARROW_LENGTH} ${ARROW_HALF_WIDTH} z`;

export type ArrowheadPlacement = {
  /** Tip position — `ARROW_TIP_GAP` units before the target along the edge. */
  tipX: number;
  tipY: number;
  /** Rotation (degrees) that aligns the triangle's +x axis with the edge. */
  angleDeg: number;
};

/**
 * Place the tip `ARROW_TIP_GAP` before the endpoint `(ex,ey)` along direction
 * `(dx,dy)`, rotated so the triangle's +x points that way. The shared core of
 * both public placers.
 */
const placeAlong = (ex: number, ey: number, dx: number, dy: number): ArrowheadPlacement => {
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  return {
    tipX: ex - ux * ARROW_TIP_GAP,
    tipY: ey - uy * ARROW_TIP_GAP,
    angleDeg: (Math.atan2(uy, ux) * 180) / Math.PI,
  };
};

/**
 * Straight source→target placement. The fallback for {@link arrowheadOnPath}
 * (and pinned directly by the unit tests). Returns `null` when the edge
 * shouldn't carry an arrowhead (`show` folds in the caller's gate — mutex edges
 * and arrow-less edges pass `false`).
 *
 * Pure: no React, no DOM.
 */
export const arrowheadPlacement = (opts: {
  show: boolean;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}): ArrowheadPlacement | null => {
  if (!opts.show) return null;
  return placeAlong(
    opts.targetX,
    opts.targetY,
    opts.targetX - opts.sourceX,
    opts.targetY - opts.sourceY
  );
};

/**
 * The endpoint + incoming tangent of an SVG path's final cubic segment
 * (`C c1x c1y c2x c2y ex ey`). The tangent `(ex − c2x, ey − c2y)` is the
 * direction the curve is travelling as it arrives at the endpoint. Returns
 * `null` when the path has no cubic (e.g. a straight `M…L…` line) or the tail
 * can't be parsed.
 *
 * Pure string math — no DOM `getPointAtLength`, so it runs at render time
 * without a path-element ref.
 */
export const terminalTangent = (
  path: string
): { ex: number; ey: number; dx: number; dy: number } | null => {
  const i = path.lastIndexOf('C');
  if (i < 0) return null;
  const nums = path
    .slice(i + 1)
    .split(/[\s,]+/)
    .filter((s) => s.length > 0)
    .map(Number);
  // A cubic carries six numbers after the `C`: c1x c1y c2x c2y ex ey.
  const c2x = nums[2];
  const c2y = nums[3];
  const ex = nums[4];
  const ey = nums[5];
  if (c2x === undefined || c2y === undefined || ex === undefined || ey === undefined) return null;
  if (Number.isNaN(c2x) || Number.isNaN(c2y) || Number.isNaN(ex) || Number.isNaN(ey)) return null;
  return { ex, ey, dx: ex - c2x, dy: ey - c2y };
};

/**
 * Arrowhead placement that follows the rendered edge's actual curve: it orients
 * to the path's terminal tangent so the tip stays on the line where it meets the
 * card (fixes arrowheads drifting off bent / converging edges). Falls back to the
 * straight source→target chord when the path has no parseable cubic. Returns
 * `null` when the edge shouldn't carry an arrowhead (`show`).
 */
export const arrowheadOnPath = (opts: {
  show: boolean;
  path: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}): ArrowheadPlacement | null => {
  if (!opts.show) return null;
  const t = terminalTangent(opts.path);
  if (t) return placeAlong(t.ex, t.ey, t.dx, t.dy);
  return placeAlong(
    opts.targetX,
    opts.targetY,
    opts.targetX - opts.sourceX,
    opts.targetY - opts.sourceY
  );
};

/** SVG transform that places + orients `ARROW_TRIANGLE_D` for a placement. */
export const arrowheadTransform = (p: ArrowheadPlacement): string =>
  `translate(${p.tipX} ${p.tipY}) rotate(${p.angleDeg})`;
