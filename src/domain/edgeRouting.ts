/**
 * Phase A — Edge routing module scaffold.
 *
 * See `docs/EDGE_ROUTING_PROPOSAL.md` for the full design. This module
 * is the obstacle-aware edge router for the dagre / flow layout. Phase
 * A introduces the API contract + types + a no-op implementation that
 * returns a default cubic bezier between source and target; Phase B
 * adds a single-obstacle heuristic; Phase C swaps in visibility-graph
 * + A\*. The user-visible ship gate is Phase C — until then the
 * router is hidden behind a constant gate in `useEdgeRoutes`.
 *
 * Layered intent: this is a pure-geometry domain function. It does NOT
 * read the store, does NOT depend on React, and does NOT touch React
 * Flow's `getBezierPath`. The point string returned is consumable by
 * any SVG renderer; `useEdgeRoutes` is the React adapter that calls
 * this and stamps the result onto each edge's `data.route`.
 *
 * The radial layout has its own router at
 * `src/components/canvas/edges/radialEdgeRouting.ts` (Session 99); the
 * two are intentionally separate. Radial routing deflects a bezier
 * perpendicular to its axis (cheap, good enough for tree geometry);
 * dagre routing in Phase C will use a real pathfinder (visibility
 * graph + A\*) so it can handle the dense / multi-obstacle cases that
 * dagre layouts hit but radial layouts don't.
 */

/** A point in flow coordinates (pre-viewport-transform). */
export type Point = { readonly x: number; readonly y: number };

/**
 * Axis-aligned bounding box represented by its top-left corner + size.
 * This matches how dagre and React Flow store node positions (top-left
 * + width / height). The radial router uses a center+half-extents
 * representation in its own module — the two formats are isomorphic but
 * we keep each module's convention local so callers don't need to
 * translate.
 */
export type Box = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/**
 * Input to {@link routeEdge}. Source / target are the visible edge
 * endpoints (handle positions, not node centers). Obstacles are the
 * bounding boxes of every NON-endpoint visible node — the caller has
 * already filtered out the source and target node so the router
 * doesn't accidentally treat its own endpoints as obstacles. Optional
 * `rankSpacing` will be used in Phase C+ to place intermediate
 * waypoints at rank boundaries on multi-rank edges; Phase A ignores
 * it.
 */
export type RoutingInput = {
  readonly source: Point;
  readonly target: Point;
  readonly obstacles: readonly Box[];
  readonly rankSpacing?: number;
};

/**
 * Output of {@link routeEdge}.
 *
 * `d` is a precomputed SVG path string consumable by React Flow's
 * `<BaseEdge path={...}>` prop verbatim. `waypoints` is the corner
 * list (source + interior corners + target) exposed for any future
 * consumer that needs hit-testing, label placement, or animation
 * along the route. Phase A returns just `[source, target]`; Phase C
 * populates interior corners from the visibility-graph A\* search.
 */
export type EdgeRoute = {
  readonly d: string;
  readonly waypoints: readonly Point[];
};

/**
 * Build a smooth cubic bezier between two points with vertical-dominant
 * control points. This matches the visual feel of React Flow's
 * `getBezierPath` for our default handle layout (source at
 * Position.Bottom, target at Position.Top), so Phase A's no-op
 * fallback is visually indistinguishable from "no router stamped".
 *
 * We hand-roll the path string instead of calling `getBezierPath`
 * because that function lives in `@xyflow/react`; the domain layer
 * should not depend on a UI library. Phase B+ will need to emit
 * paths with interior corners anyway, so a hand-rolled path builder
 * is the foundation we want.
 */
export const defaultBezierPath = (source: Point, target: Point): string => {
  // Control points at the vertical midpoint between source and target.
  // For source-above-target (target.y > source.y) this produces a
  // gentle downward arc; for source-below-target it's an upward arc.
  // Symmetric in either direction.
  const midY = (source.y + target.y) / 2;
  return (
    `M${source.x},${source.y} ` +
    `C${source.x},${midY} ` +
    `${target.x},${midY} ` +
    `${target.x},${target.y}`
  );
};

/**
 * Phase A implementation: route the edge by returning a default cubic
 * bezier from source to target. Obstacles are accepted but currently
 * ignored — the router walks through them. Phase B introduces a
 * single-obstacle deflection; Phase C swaps in visibility-graph + A\*.
 *
 * The function is total (never throws) and pure (no side effects, no
 * store reads). Degenerate inputs:
 *   - `source === target`: emits `M sx,sy L sx,sy` so the SVG renderer
 *     doesn't choke on a malformed path. Real React Flow edges never
 *     hit this case (source and target are distinct nodes), but the
 *     guard keeps the function total.
 */
export const routeEdge = (input: RoutingInput): EdgeRoute => {
  const { source, target } = input;
  // Zero-length segment — emit a degenerate no-op path.
  if (source.x === target.x && source.y === target.y) {
    return {
      d: `M${source.x},${source.y} L${source.x},${source.y}`,
      waypoints: [source, target],
    };
  }
  return {
    d: defaultBezierPath(source, target),
    waypoints: [source, target],
  };
};
