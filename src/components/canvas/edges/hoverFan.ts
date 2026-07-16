import type { Point } from '@/domain/edgeGeometry';

/**
 * Hover-fan (Session 185) — pure helpers for spreading converging edges apart on
 * hover so an overlapping one can be grabbed directly. Kept out of `TPEdge` so the
 * gating and the offset are unit-testable without a React Flow render (the
 * end-to-end spread is verified separately against a real browser).
 */

/**
 * Whether this edge should fan right now: its convergence group is hovered and
 * the group has 2+ members.
 *
 * Session 206 — the old `routeWaypointCount <= 2` gate is gone. It existed
 * because the fan used to REPLACE a routed path with a straight bezier, which
 * erased an obstacle detour (the "pop"), so detours were held back. The fan now
 * nudges a detour's final waypoint and rebuilds the path with the router's own
 * helper instead (see `offsetLastWaypoint`), so the detour survives and there is
 * nothing left to gate.
 */
export function hoverFanActive(opts: { isFanGroupHovered: boolean; fanCount: number }): boolean {
  return opts.isFanGroupHovered && opts.fanCount > 1;
}

/**
 * Lateral target-X offset for the edge at `fanRank` within a group of `fanCount`,
 * spread symmetrically around the shared endpoint — so the middle edge of an odd
 * group stays put and the outers move ±. `spacing` is kept below the edge
 * hit-tolerance so the hovered edge stays under the pointer as the group spreads.
 */
export function hoverFanOffsetX(fanRank: number, fanCount: number, spacing: number): number {
  return (fanRank - (fanCount - 1) / 2) * spacing;
}

/**
 * The crossing-free rank for `selfSourceId` among its convergence `siblings`,
 * ordered left-to-right by source X (tiebreak by id for determinism). Assigning
 * the fan slots in this order means an edge from a left-hand source gets a
 * left-hand slot, so fanned siblings never cross. Returns `-1` when `selfSourceId`
 * isn't among the siblings (caller falls back to the stable sourceId order).
 *
 * Pure — `TPEdge` supplies the live positions on hover (a static layout), so this
 * never runs against per-frame drag positions.
 */
export function fanRankByPositions(
  selfSourceId: string,
  siblings: { id: string; x: number }[]
): number {
  const ordered = [...siblings].sort(
    (a, b) => a.x - b.x || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
  return ordered.findIndex((s) => s.id === selfSourceId);
}

/**
 * Session 206 — the radial counterpart of {@link fanRankByPositions}: rank by the
 * ANGLE each source approaches `target` from, counter-clockwise from due east.
 *
 * A flow layout stacks a target's causes below it, so they arrive on roughly
 * parallel headings and "left-to-right by source X" is the order that keeps the
 * fanned slots from crossing. A radial layout puts the target at a hub with its
 * causes spread around it, so two sources on opposite sides can share an X while
 * arriving from opposite directions — X order there is meaningless. Approach
 * angle is the property that actually generalises.
 *
 * The ±π wrap means a group straddling due west gets its cut somewhere inside
 * the group rather than outside it. The order stays deterministic and still
 * separates the edges (only the slot assignment rotates), and a convergence
 * group sits inside one angular slice in practice, so it isn't worth a
 * circular-gap scan to fix.
 *
 * Returns `-1` when `selfSourceId` isn't among the siblings.
 */
export function fanRankByAngle(
  selfSourceId: string,
  siblings: { id: string; x: number; y: number }[],
  target: Point
): number {
  const angle = (s: { x: number; y: number }): number => Math.atan2(s.y - target.y, s.x - target.x);
  const ordered = [...siblings].sort(
    (a, b) => angle(a) - angle(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
  return ordered.findIndex((s) => s.id === selfSourceId);
}

/**
 * Session 206 — offset `to` by `offset` PERPENDICULAR to the `from → to` heading.
 *
 * This is the fan gesture generalised. A flow layout's causes sit below their
 * effect and arrive heading "up", and the perpendicular of "up" is lateral X — so
 * for flow this reproduces exactly the lateral spread the fan has always used.
 * In a radial layout the same rule spreads the arrivals across the face the edge
 * actually approaches from, instead of shoving every edge sideways regardless of
 * where it came from.
 *
 * Returns `to` unchanged for a zero-length heading (no direction to be
 * perpendicular to).
 */
export function fanPerpendicularOffset(from: Point, to: Point, offset: number): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return to;
  // Unit normal: the heading rotated 90°. For a due-north heading (dy < 0) this
  // is +X, which is what keeps the flow-layout fan byte-identical.
  return { x: to.x + (-dy / len) * offset, y: to.y + (dx / len) * offset };
}

/**
 * Session 206 — a copy of `waypoints` with only the FINAL point nudged laterally
 * by `dx`.
 *
 * This is what lets a detour fan at all. `routeEdge` builds its path as
 * `bezierThroughWaypoints(waypoints)`, so re-running that pure helper over nudged
 * waypoints re-emits the same detour with a spread arrival — no A* re-run, and
 * the obstacle avoidance the router computed is preserved everywhere except the
 * last leg. (The last leg can graze an obstacle the router had cleared; the
 * spread is bounded by the fan spacing and lasts only while hovered.)
 */
export function offsetLastWaypoint(waypoints: readonly Point[], dx: number): Point[] {
  const out = waypoints.map((p) => ({ x: p.x, y: p.y }));
  const last = out[out.length - 1];
  if (last) last.x += dx;
  return out;
}
