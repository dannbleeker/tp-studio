/**
 * Back-edge loop routing (Wave 3 item 2).
 *
 * Item 1 made a back-edge (a cycle's loop-closer) exit the source's TOP and
 * enter the target's BOTTOM. But when the source sits directly below/above the
 * target, that straight top→bottom path lands in the SAME corridor as the
 * forward edge (only colour + dash tell them apart), or runs straight through
 * both node boxes. This module bows the back-edge out to one side so it reads
 * as a distinct feedback LOOP.
 *
 * Pure geometry — no store, no React. The side heuristic is obstacle-aware: it
 * prefers a side whose bulge is clear and returns `null` when BOTH sides are
 * blocked, so the caller can fall back to the straight obstacle-avoiding route
 * rather than force an ugly detour (Dann's rule).
 */

import type { Box, Point } from './edgeGeometry';

export type LoopSide = 'left' | 'right';

/** Vertical control-point reach as a fraction of the anchors' y-span — sets how
 *  tall the loop's shoulders are. Clamped so tiny gaps still bulge and huge
 *  spans don't balloon. */
const VERTICAL_REACH_FACTOR = 0.4;
const MIN_VERTICAL_REACH = 32;
const MAX_VERTICAL_REACH = 240;

/** AABB overlap (a touching edge counts as clear — strict inequality). */
const boxesOverlap = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/**
 * Pick the side a back-edge should bow toward. Probes the rectangular region
 * each bulge would sweep (anchor mid-x out to the apex, over the anchors'
 * y-span) and prefers a CLEAR side; ties go right (deterministic). Returns
 * `null` when both sides are obstructed, signalling the caller to keep the
 * straight route instead of forcing the loop through a node.
 */
export const backEdgeLoopSide = (
  sourceAnchor: Point,
  targetAnchor: Point,
  obstacles: readonly Box[],
  reach: number
): LoopSide | null => {
  const midX = (sourceAnchor.x + targetAnchor.x) / 2;
  const y = Math.min(sourceAnchor.y, targetAnchor.y);
  const height = Math.max(1, Math.abs(targetAnchor.y - sourceAnchor.y));
  const blocked = (dir: 1 | -1): boolean => {
    const apexX = midX + dir * reach;
    const probe: Box = { x: Math.min(midX, apexX), y, width: Math.abs(apexX - midX), height };
    return obstacles.some((o) => boxesOverlap(o, probe));
  };
  if (!blocked(1)) return 'right';
  if (!blocked(-1)) return 'left';
  return null;
};

/**
 * Build the bowed back-edge path: a single cubic from the source's top anchor
 * to the target's bottom anchor whose control points are pushed out to `side`
 * (and along each end's outward normal — source up, target down), so the curve
 * swings clear of the forward corridor and reads as a loop. Returns the SVG `d`
 * plus a coarse 3-point polyline (apex in the middle) for crossing / hit-testing.
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
  const span = Math.abs(ty - sy);
  const vReach = Math.max(
    MIN_VERTICAL_REACH,
    Math.min(MAX_VERTICAL_REACH, span * VERTICAL_REACH_FACTOR)
  );
  const c1x = sx + dir * reach;
  const c1y = sy - vReach;
  const c2x = tx + dir * reach;
  const c2y = ty + vReach;
  const d = `M${sx},${sy} C${c1x},${c1y} ${c2x},${c2y} ${tx},${ty}`;
  const apex = { x: (sx + tx) / 2 + dir * reach, y: (sy + ty) / 2 };
  return { d, waypoints: [sourceAnchor, apex, targetAnchor] };
};
