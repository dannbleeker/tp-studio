import type { TPDocument } from '@/domain/types';

/**
 * Shared junctor geometry — the horizontal placement of an AND / OR / XOR
 * junctor circle, used by BOTH `JunctorOverlay` (draws the circle + the line up
 * to the effect) and `TPEdge` (terminates each cause-edge at the circle). They
 * MUST agree, so the math lives here and both call it with the same live node
 * positions.
 *
 * The old behaviour pinned the circle at the *target's* X (directly under the
 * effect). When a cause sat far to the side — e.g. a CRT effect that also feeds
 * another effect, so dagre pulls it off-axis — its cause-edge had to sweep
 * sideways into the circle and "entered from the side." Centering the circle
 * over its *causes* instead lets every cause rise into it from below; the single
 * line up to the effect becomes a short diagonal.
 */

/**
 * How far to slide the junctor back toward the target from the pure cause
 * centroid, as a fraction in [0, 1]. `0` = sit exactly over the causes'
 * midpoint (cause-edges most vertical, the line to the effect most diagonal);
 * `1` = the old behaviour (pinned under the target). A small nudge keeps the
 * effect-side line from leaning too far when the causes are well off-axis, while
 * still letting the causes converge from below.
 */
export const JUNCTOR_NUDGE_TOWARD_TARGET = 0.25;

/**
 * Horizontal center of a junctor: the mean of its causes' center-X, slid
 * `nudge` of the way back toward the target. Falls back to the target's X when
 * no cause positions are known yet (first paint, before React Flow has measured
 * the source nodes) so the circle never jumps to 0.
 */
export const junctorCenterX = (
  sourceXs: readonly number[],
  targetX: number,
  nudge: number = JUNCTOR_NUDGE_TOWARD_TARGET
): number => {
  if (sourceXs.length === 0) return targetX;
  const mid = sourceXs.reduce((sum, x) => sum + x, 0) / sourceXs.length;
  return mid + (targetX - mid) * nudge;
};

/**
 * Re-anchor a junctor cause-edge's SOURCE onto its node's real edge.
 *
 * Junctor cause-edges bypass the smart router (which anchors every other edge on
 * the node's BOX boundary), so they fall back to React Flow's raw handle position
 * — and React Flow reports that at the OUTER edge of the 20px (`!h-5`) handle,
 * ~10px off the card. That left a visible gap at the cause ("the AND edges don't
 * touch the sender entity"; routed edges are flush, junctor ones float). Swap the
 * off-flow-axis coordinate for the node's true edge while keeping the handle's
 * on-axis center:
 *   - vertical trees  → source handle is Top  → use the node TOP (`topLeft.y`);
 *   - horizontal (EC) → source handle is Left → use the node LEFT (`topLeft.x`).
 * `topLeft` is the source node's absolute top-left; `null` (node not measured
 * yet, or a non-junctor edge) leaves the handle point untouched.
 */
export const junctorSourceAnchor = (
  axis: 'vertical' | 'horizontal',
  handleX: number,
  handleY: number,
  topLeft: { x: number; y: number } | null
): { x: number; y: number } => {
  if (!topLeft) return { x: handleX, y: handleY };
  return axis === 'vertical' ? { x: handleX, y: topLeft.y } : { x: topLeft.x, y: handleY };
};

/**
 * SVG path for a junctor's OUTPUT arrow — from the circle center (`cx,cy`) up into
 * the effect's bottom-center (`tx,ty`). A rounded "L": both control points sit at
 * the circle's Y, so the curve traverses sideways at the junctor's level then rises
 * STRAIGHT UP into the effect. The long vertical final approach — the 2nd control
 * point shares the endpoint's X (`tx`) — makes the `orient="auto"` arrowhead read as
 * perpendicular INTO the card, not along the offset diagonal a straight line drew
 * (which looked like it pointed at a neighbouring edge). The junctor gap is only
 * ~35px, so a SHORT vertical run wasn't enough for the arrowhead to look vertical.
 */
export const junctorOutputPath = (cx: number, cy: number, tx: number, ty: number): string =>
  `M ${cx} ${cy} C ${(cx + tx) / 2} ${cy}, ${tx} ${cy}, ${tx} ${ty}`;

/**
 * The source-entity ids of every edge in a given junctor group. Used by TPEdge
 * to gather the cause positions it needs for {@link junctorCenterX} (the same
 * set JunctorOverlay derives per group). Order follows iteration order; callers
 * that need a stable key should sort.
 */
export const collectGroupSourceIds = (
  edges: TPDocument['edges'],
  field: 'andGroupId' | 'orGroupId' | 'xorGroupId',
  groupId: string
): string[] => {
  const ids: string[] = [];
  for (const edge of Object.values(edges)) {
    if (edge[field] === groupId) ids.push(edge.sourceId);
  }
  return ids;
};
