/**
 * Session 138 — edge-path priority resolution, pulled out of `TPEdge` so the
 * "which of the four path strategies wins" decision is a pure, unit-tested
 * function rather than a `??` chain buried in a ~470-line component. This is
 * the seam to reach for when an edge (a junctor / AND edge especially) renders
 * along the wrong path.
 *
 * Priority, highest first:
 *   1. `mutex`      — the bidirectional-conflict straight-line override.
 *   2. `radial`     — the radial-layout obstacle-deflection route.
 *   3. `routedPath` — the dagre-mode smart router's precomputed `d` string. It
 *                     carries no label anchor, so the label is anchored at the
 *                     midpoint *along its waypoints* when those are supplied
 *                     (the routed path can bend far from the straight bezier
 *                     midpoint), falling back to the bezier midpoint otherwise.
 *   4. `bezier`     — React Flow's default bezier between the handles.
 *
 * `routedPath` is kept when it is a non-null string — INCLUDING the empty
 * string — to preserve the exact `routedPath ?? bezierPath` semantics of the
 * original (only `null` / `undefined` fall through).
 */
import { type Point, waypointMidpoint } from '@/domain/edgeGeometry';

export type EdgePathCandidate = { path: string; labelX: number; labelY: number };

export const resolveEdgePath = (input: {
  mutex: EdgePathCandidate | null;
  radial: EdgePathCandidate | null;
  routedPath: string | undefined;
  routeWaypoints?: readonly Point[] | undefined;
  bezier: EdgePathCandidate;
}): EdgePathCandidate => {
  const { mutex, radial, routedPath, routeWaypoints, bezier } = input;
  if (mutex) return mutex;
  if (radial) return radial;
  if (routedPath != null) {
    // The smart router carries no label anchor. Prefer the midpoint along the
    // routed waypoints (a bent route's visual middle can sit far from — even
    // inside an obstacle near — the straight bezier midpoint); fall back to the
    // bezier midpoint when waypoints are absent or degenerate.
    const mid =
      routeWaypoints && routeWaypoints.length >= 2
        ? waypointMidpoint(routeWaypoints)
        : { x: bezier.labelX, y: bezier.labelY };
    return { path: routedPath, labelX: mid.x, labelY: mid.y };
  }
  return bezier;
};
