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
 *  own half-width). The WIDTH dial — how far the loop swings out to the side; a wider
 *  swing reads as a broader, rounder corner (Dann's "more round / wider"). */
const CLEAR_MARGIN = 110;
/** How far each rail END is pulled OFF the card it meets — up off the source's top,
 *  down off the target's bottom — so the loop domes over WELL clear of the entity
 *  instead of cornering against the card edge. The ROUNDNESS dial — a taller dome /
 *  deeper bowl reads as a gentler, rounder loop top & bottom (Dann's "more round"). */
const LOOP_END_CLEAR = 120;
/** In the COMPACT case (the whole loop fits in the gap between the cards), cap the
 *  end-clearance at this fraction of the gap so the two rail ends can't cross and
 *  reverse the rail. < 0.5 always leaves a straight rail between them. */
const LOOP_END_CLEAR_MAX_FRACTION = 0.42;
/** Tangent-handle length as a fraction of the end-clearance. Short enough that the
 *  curve turns onto the rail UP near the rail end (clear of the card), not back down
 *  at the card's own level — the bug that made the old corner hug the entity. */
const LOOP_TANGENT_FRACTION = 0.6;

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
 * Build the bowed back-edge path: source → out to the rail → straight along the
 * clear rail → in to the target, with rounded joins so it reads organic.
 *
 * The rail's two ends are pulled a clear margin OFF the cards they meet — up off
 * the source's TOP, down off the target's BOTTOM (the fixed back-edge exit
 * convention, NOT the relative position). So the loop always turns onto the rail
 * well clear of the entity rather than cornering against the card edge — whether
 * the loop sits compactly in the gap between the cards (source below target) or
 * wraps the long way around (source above target). The short tangent handles keep
 * the turn UP near the rail end, not back down at the card's own level.
 *
 * `obstacles` (the spanned cards, optional) matters only in the COMPACT case: the
 * diagonal sweep from an anchor to its rail end can graze a card sitting colinear
 * between source and target, so each rail end is pulled to that card's near edge —
 * the sweep then reaches the rail clear of it (the rail itself clears it by `reach`).
 *
 * Returns the SVG `d` plus the 4-point polyline (source, two rail ends, target)
 * for crossing / hit-testing.
 */
export const backEdgeLoopRoute = (
  sourceAnchor: Point,
  targetAnchor: Point,
  side: LoopSide,
  reach: number,
  obstacles: readonly Box[] = []
): { d: string; waypoints: Point[] } => {
  const dir = side === 'right' ? 1 : -1;
  const { x: sx, y: sy } = sourceAnchor;
  const { x: tx, y: ty } = targetAnchor;
  const railX = (sx + tx) / 2 + dir * reach;
  // `span > 0` ⇒ the source's top sits below the target's bottom: the loop fits
  // COMPACTLY in the gap, so the clearance is capped to keep a straight rail. Else
  // the loop WRAPS around and the full clearance is always available.
  const span = sy - ty;
  const clr =
    span > 0 ? Math.min(LOOP_END_CLEAR, span * LOOP_END_CLEAR_MAX_FRACTION) : LOOP_END_CLEAR;
  let sJoin = sy - clr; // rail end up off the source's TOP
  let tJoin = ty + clr; // rail end down off the target's BOTTOM
  // COMPACT only: pull each rail end to the near edge of a card sitting colinear
  // between the endpoints, so the diagonal sweep clears it rather than grazing its
  // corner. (Whole `o.x..o.x+width` between the rail and the anchors ⇒ the sweep
  // passes it.) The wrap case skips this — its sweeps are clear above / below.
  if (span > 0) {
    const lo = Math.min(sx, railX);
    const hi = Math.max(sx, railX);
    for (const o of obstacles) {
      if (o.x + o.width <= lo || o.x >= hi) continue; // not under the sweep span
      const oTop = o.y;
      const oBot = o.y + o.height;
      if (oBot <= sy && oBot > sJoin) sJoin = oBot; // source sweep stays at/below its bottom
      if (oTop >= ty && oTop < tJoin) tJoin = oTop; // target sweep stays at/above its top
    }
  }
  const railDir = tJoin >= sJoin ? 1 : -1; // the rail's onward y-direction (source → target end)
  // Per-end tangent handles, sized to the ACTUAL dome height after any clamp, so a
  // shortened end (compact clamp) eases in without overshooting past its rail end.
  const hs = Math.abs(sy - sJoin) * LOOP_TANGENT_FRACTION;
  const ht = Math.abs(tJoin - ty) * LOOP_TANGENT_FRACTION;
  // Source exits straight UP (its top), eases onto the rail end; rail runs straight;
  // off the rail it eases straight DOWN into the target (entering its bottom).
  const toRail = `C${sx},${sy - hs} ${railX},${sJoin - railDir * hs} ${railX},${sJoin}`;
  const rail = `L${railX},${tJoin}`;
  const toTarget = `C${railX},${tJoin + railDir * ht} ${tx},${ty + ht} ${tx},${ty}`;
  const d = `M${sx},${sy} ${toRail} ${rail} ${toTarget}`;
  const waypoints = [sourceAnchor, { x: railX, y: sJoin }, { x: railX, y: tJoin }, targetAnchor];
  return { d, waypoints };
};
