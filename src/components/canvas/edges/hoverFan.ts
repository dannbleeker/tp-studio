/**
 * Hover-fan (Session 185) — pure helpers for spreading converging edges apart on
 * hover so an overlapping one can be grabbed directly. Kept out of `TPEdge` so the
 * gating and the offset are unit-testable without a React Flow render (the
 * end-to-end spread is verified separately against a real browser).
 */

/**
 * Whether this edge should fan right now. True only when its convergence group is
 * hovered, the group has 2+ members, and its route is DIRECT (`≤2` waypoints) — a
 * detoured route stays put so it doesn't snap from its obstacle detour to a
 * straight bezier (the "pop"). A missing route (direct-routing mode) is direct, so
 * a waypoint count of 0 fans.
 */
export function hoverFanActive(opts: {
  isFanGroupHovered: boolean;
  fanCount: number;
  routeWaypointCount: number;
}): boolean {
  return opts.isFanGroupHovered && opts.fanCount > 1 && opts.routeWaypointCount <= 2;
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
