/**
 * Back-edge loop routing (Wave 3 item 2 / item 3).
 *
 * A back-edge (a cycle's loop-closer) exits the source's TOP and enters the
 * target's BOTTOM. Drawn straight, that path overlaps the forward edge's
 * corridor or runs through the node boxes. This module bows it out to one side
 * as a RAIL/bracket: a short sweep out from the source, a straight vertical run
 * clear of the chain, and a short sweep back in to the target — so it reads as a
 * distinct feedback LOOP and never crosses behind an entity.
 *
 * Why a rail (not a single bulging cubic): a single cubic is widest at its
 * MIDDLE and pinches toward the ends, so an obstacle sitting near the source or
 * target can still be crossed. A vertical rail is equidistant from the chain
 * along the whole span, so the reach needed to clear every obstacle is exact.
 *
 * Pure geometry — no store, no React. Obstacle-aware: the reach is widened so
 * the rail clears every card the loop passes, plus a margin, and the side with
 * the smaller required reach is chosen.
 */

import type { Box, Point } from './edgeGeometry';

export type LoopSide = 'left' | 'right';

/** Visible gap the rail keeps past the cards it clears (and past the endpoints'
 *  own half-width). Dann's "go a bit further to the side" dial. */
const CLEAR_MARGIN = 60;
/** Rounded-corner radius as a fraction of the reach — bigger reads more organic /
 *  less square. Clamped to half the loop's span so the two corners can't overlap. */
const LOOP_CORNER_FACTOR = 0.7;

const spanOverlaps = (box: Box, top: number, bot: number): boolean =>
  box.y < bot && box.y + box.height > top;

/**
 * Reach (rail distance from the loop's central axis) on `side` so the vertical
 * rail clears every obstacle the loop's vertical span passes, plus
 * {@link CLEAR_MARGIN}. Never below `floor` (clears the endpoints' own width).
 */
const reachForSide = (
  midX: number,
  top: number,
  bot: number,
  side: LoopSide,
  obstacles: readonly Box[],
  floor: number
): number => {
  let reach = floor;
  for (const o of obstacles) {
    if (!spanOverlaps(o, top, bot)) continue;
    const need = side === 'left' ? midX - o.x + CLEAR_MARGIN : o.x + o.width - midX + CLEAR_MARGIN;
    if (need > reach) reach = need;
  }
  return reach;
};

/**
 * Choose the bow side + the obstacle-clearing reach for a back-edge loop. Picks
 * the side that needs the SMALLER rail (less obstruction); ties go left.
 * `endpointHalfWidth` is half the wider endpoint box, so the rail clears the
 * source / target too.
 */
export const backEdgeLoopPlan = (
  sourceAnchor: Point,
  targetAnchor: Point,
  obstacles: readonly Box[],
  endpointHalfWidth: number
): { side: LoopSide; reach: number } => {
  const midX = (sourceAnchor.x + targetAnchor.x) / 2;
  const top = Math.min(sourceAnchor.y, targetAnchor.y);
  const bot = Math.max(sourceAnchor.y, targetAnchor.y);
  const floor = endpointHalfWidth + CLEAR_MARGIN;
  const left = reachForSide(midX, top, bot, 'left', obstacles, floor);
  const right = reachForSide(midX, top, bot, 'right', obstacles, floor);
  return left <= right ? { side: 'left', reach: left } : { side: 'right', reach: right };
};

/**
 * Build the bowed back-edge path: source → out to the rail → straight down the
 * clear rail → in to the target. The rail overshoots the anchors by
 * {@link END_OVERSHOOT} so the in/out sweeps clear the source / target corners.
 * Returns the SVG `d` plus the 4-point polyline for crossing / hit-testing.
 */
export const backEdgeLoopRoute = (
  sourceAnchor: Point,
  targetAnchor: Point,
  side: LoopSide,
  reach: number
): { d: string; waypoints: Point[] } => {
  const dir = side === 'right' ? 1 : -1;
  const { x: sx, y: sy } = sourceAnchor;
  const { x: tx, y: ty } = targetAnchor;
  const railX = (sx + tx) / 2 + dir * reach;
  const dirY = ty >= sy ? 1 : -1; // rail runs toward the target end
  const r = Math.min(Math.abs(reach) * LOOP_CORNER_FACTOR, Math.abs(ty - sy) / 2);
  const p1y = sy + dirY * r; // rail point near the source (after the rounded corner)
  const p2y = ty - dirY * r; // rail point near the target (before the rounded corner)
  // Source exits 'top' (up) and eases into the rail; rail runs straight (clear of
  // the chain); the bottom eases off the rail into the target 'bottom' (from below).
  // Smooth (C1-ish) at both rail joins, so the loop reads round, not square.
  const toRail = `C${sx},${sy - r} ${railX},${sy} ${railX},${p1y}`;
  const rail = `L${railX},${p2y}`;
  const toTarget = `C${railX},${ty} ${tx},${ty + r} ${tx},${ty}`;
  const d = `M${sx},${sy} ${toRail} ${rail} ${toTarget}`;
  const waypoints = [sourceAnchor, { x: railX, y: p1y }, { x: railX, y: p2y }, targetAnchor];
  return { d, waypoints };
};
