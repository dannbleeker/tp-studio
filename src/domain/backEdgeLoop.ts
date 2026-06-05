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

import { bezierThroughWaypointsSided } from './edgeBezier';
import type { Box, Point } from './edgeGeometry';

export type LoopSide = 'left' | 'right';

/** Visible gap the rail keeps past the cards it clears (and past the endpoints'
 *  own half-width). Dann's "go a bit further to the side" dial. */
const CLEAR_MARGIN = 60;
/** How far the rail extends past the top/bottom anchors, so the sweep into the
 *  source / target clears their near corners instead of grazing them. */
const END_OVERSHOOT = 28;

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
  const railX = (sourceAnchor.x + targetAnchor.x) / 2 + dir * reach;
  const top = Math.min(sourceAnchor.y, targetAnchor.y) - END_OVERSHOOT;
  const bot = Math.max(sourceAnchor.y, targetAnchor.y) + END_OVERSHOOT;
  // Rail corners ordered from the source end to the target end.
  const sourceIsTop = sourceAnchor.y <= targetAnchor.y;
  const railNearSource = { x: railX, y: sourceIsTop ? top : bot };
  const railNearTarget = { x: railX, y: sourceIsTop ? bot : top };
  const waypoints = [sourceAnchor, railNearSource, railNearTarget, targetAnchor];
  const d = bezierThroughWaypointsSided(waypoints, 'top', 'bottom');
  return { d, waypoints };
};
