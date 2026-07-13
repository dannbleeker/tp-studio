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
