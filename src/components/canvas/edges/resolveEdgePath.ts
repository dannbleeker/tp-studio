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
 *                     carries no label anchor, so the label borrows the bezier
 *                     midpoint (matching the prior chain, which never sourced a
 *                     label from the routed path).
 *   4. `bezier`     — React Flow's default bezier between the handles.
 *
 * `routedPath` is kept when it is a non-null string — INCLUDING the empty
 * string — to preserve the exact `routedPath ?? bezierPath` semantics of the
 * original (only `null` / `undefined` fall through).
 */
export type EdgePathCandidate = { path: string; labelX: number; labelY: number };

export const resolveEdgePath = (input: {
  mutex: EdgePathCandidate | null;
  radial: EdgePathCandidate | null;
  routedPath: string | undefined;
  bezier: EdgePathCandidate;
}): EdgePathCandidate => {
  const { mutex, radial, routedPath, bezier } = input;
  if (mutex) return mutex;
  if (radial) return radial;
  if (routedPath != null) {
    return { path: routedPath, labelX: bezier.labelX, labelY: bezier.labelY };
  }
  return bezier;
};
