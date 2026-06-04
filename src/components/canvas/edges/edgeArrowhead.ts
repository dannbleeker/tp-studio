/**
 * The cause→effect arrowhead — single source of truth for its geometry,
 * tuning constants, and the emission↔render id tags.
 *
 * **Why a custom `<path>` and not React Flow's SVG `markerEnd`:** a `markerEnd`
 * marker always orients to the path's ENDPOINT tangent — the target handle's
 * fixed normal (vertical for a `Position.Bottom` handle). But the routed/bezier
 * edge approaches the box *diagonally*, so a marker pointed the wrong way and
 * (when offset for clearance) tucked under the card. `TPEdge` instead renders
 * the arrowhead itself as a `<path>` oriented to the actual source→target
 * direction (see `arrowheadPlacement`), so it sits flush on the line with the
 * stroke running straight out of its tip into the entity.
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
/** How far before the target the tip sits, so the stroke runs out of it. */
export const ARROW_TIP_GAP = 11;

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
 * Where + how to draw a causal edge's arrowhead, oriented to the straight
 * source→target direction (a good match for the gentle routed/bezier curve
 * near the target). Returns `null` when the edge shouldn't carry one (`show`
 * folds in the caller's gate — mutex edges and arrow-less edges pass `false`).
 *
 * Pure: no React, no DOM — unit-tested in `edgeArrowhead.test.ts`.
 */
export const arrowheadPlacement = (opts: {
  show: boolean;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}): ArrowheadPlacement | null => {
  if (!opts.show) return null;
  const dx = opts.targetX - opts.sourceX;
  const dy = opts.targetY - opts.sourceY;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  return {
    tipX: opts.targetX - ux * ARROW_TIP_GAP,
    tipY: opts.targetY - uy * ARROW_TIP_GAP,
    angleDeg: (Math.atan2(uy, ux) * 180) / Math.PI,
  };
};

/** SVG transform that places + orients `ARROW_TRIANGLE_D` for a placement. */
export const arrowheadTransform = (p: ArrowheadPlacement): string =>
  `translate(${p.tipX} ${p.tipY}) rotate(${p.angleDeg})`;
