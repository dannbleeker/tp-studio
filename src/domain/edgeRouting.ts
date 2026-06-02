/**
 * Edge routing module — obstacle-aware path finding for the dagre / flow
 * layout. See `docs/EDGE_ROUTING_PROPOSAL.md` for the full design.
 *
 * Phasing on main:
 *   - **Phase A** (shipped): API contract + types + no-op `routeEdge`
 *     returning a bezier verbatim.
 *   - **Phase B** (shipped): single-obstacle deflection heuristic.
 *     Bezier-sample hit-test against axis-aligned boxes; when exactly
 *     one obstacle blocks the curve, emit a smoothed two-cubic path
 *     through a waypoint placed above or below the obstacle (shorter
 *     side wins).
 *   - **Phase C** (shipped): visibility-graph + A\* router for
 *     the multi-obstacle case.
 *   - **Phase D** (shipped): junctor segment integration + WeakMap
 *     route cache + USER_GUIDE + CHANGELOG.
 *
 * Session 164 — split into leaf modules to tame the file size, keeping this as
 * the orchestrator + the single public entry point (`@/domain/edgeRouting`):
 *   - `edgeGeometry.ts` — shared types (`Point` / `Box`), constants
 *     (`OBSTACLE_PADDING` / `DETOUR_CLEARANCE`), and box/segment primitives.
 *     A dependency-free leaf, so the old `edgeSides` ↔ `edgeRouting` value
 *     cycle is gone (`edgeSides` now imports the geometry leaf directly).
 *   - `edgeBezier.ts` — the SVG bezier emitters + samplers.
 *   - `edgeVisibilityGraph.ts` — the visibility-graph + A\* engine.
 * This file owns `routeEdge` (the orchestrator), the blocking-obstacle
 * hit-test, the single-obstacle detour heuristic, and re-exports the
 * sub-modules' public surface so existing consumers import unchanged.
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
 * dagre routing uses the visibility-graph + A\* approach here because
 * dagre layouts are flow-rank-oriented and routinely produce multi-
 * obstacle crossings that a single perpendicular deflection can't fix.
 */

import {
  bezierThroughWaypoints,
  defaultBezierPath,
  sampleDefaultBezier,
  sampleSidedBezier,
} from './edgeBezier';
import {
  type Box,
  DETOUR_CLEARANCE,
  OBSTACLE_PADDING,
  type Point,
  padBox,
  segmentIntersectsBox,
} from './edgeGeometry';
// `Side` is a type — type-only import, erased at compile time, so this carries
// no runtime dependency on `edgeSides` (which itself imports the geometry leaf,
// not this module).
import type { Side } from './edgeSides';
import { findVisibilityPath } from './edgeVisibilityGraph';

/**
 * Input to {@link routeEdge}. Source / target are the visible edge
 * endpoints (handle positions, not node centers). Obstacles are the
 * bounding boxes of every NON-endpoint visible node — the caller has
 * already filtered out the source and target node so the router
 * doesn't accidentally treat its own endpoints as obstacles.
 *
 * `obstaclePadding` lets the caller widen each obstacle by a fixed
 * margin before hit-testing — the visible node footprint is the
 * bounding box, but routes that just graze a node read worse than
 * routes that clear it cleanly. Default is `OBSTACLE_PADDING` (8 px,
 * per the proposal's "padded axis-aligned bounding box" decision).
 */
export type RoutingInput = {
  readonly source: Point;
  readonly target: Point;
  readonly obstacles: readonly Box[];
  readonly obstaclePadding?: number;
};

/**
 * Output of {@link routeEdge}.
 *
 * `d` is a precomputed SVG path string consumable by React Flow's
 * `<BaseEdge path={...}>` prop verbatim. `waypoints` is the corner
 * list (source + interior corners + target) exposed for any future
 * consumer that needs hit-testing, label placement, or animation
 * along the route. Phase A returned just `[source, target]`; Phase B
 * adds a single interior corner for the single-blocker case; Phase C
 * populates richer corner lists from the A\* search.
 */
export type EdgeRoute = {
  readonly d: string;
  readonly waypoints: readonly Point[];
};

/** Shared core — which obstacles a sampled polyline crosses. Returns the
 *  blocking boxes in their original (unpadded) form. */
const blockersForSamples = (
  samples: readonly Point[],
  obstacles: readonly Box[],
  padding: number
): Box[] => {
  if (obstacles.length === 0) return [];
  const blockers: Box[] = [];
  for (const box of obstacles) {
    const padded = padBox(box, padding);
    let blocked = false;
    for (let i = 0; i < samples.length - 1; i++) {
      const a = samples[i];
      const b = samples[i + 1];
      if (a === undefined || b === undefined) continue;
      if (segmentIntersectsBox(a, b, padded)) {
        blocked = true;
        break;
      }
    }
    if (blocked) blockers.push(box);
  }
  return blockers;
};

/**
 * Find every obstacle whose padded bounding box is crossed by the
 * sampled bezier polyline between `source` and `target`. Returns the
 * boxes in their original (unpadded) form so callers can compute
 * detour offsets relative to the visible footprint.
 *
 * Exported for direct unit testing of the hit-test layer.
 */
export const findBlockingObstacles = (
  source: Point,
  target: Point,
  obstacles: readonly Box[],
  padding: number = OBSTACLE_PADDING
): Box[] => blockersForSamples(sampleDefaultBezier(source, target), obstacles, padding);

/**
 * Side-aware sibling of {@link findBlockingObstacles} — samples the
 * sided bezier so the curvature-dip test is correct when the edge
 * leaves / enters a horizontal side.
 */
export const findBlockingObstaclesSided = (
  source: Point,
  sourceSide: Side,
  target: Point,
  targetSide: Side,
  obstacles: readonly Box[],
  padding: number = OBSTACLE_PADDING
): Box[] =>
  blockersForSamples(sampleSidedBezier(source, sourceSide, target, targetSide), obstacles, padding);

/**
 * Pick the waypoint coordinates for a single-obstacle detour. The
 * waypoint sits horizontally above or below the obstacle (whichever
 * side requires the smaller vertical excursion from the source→target
 * midpoint) and horizontally at the obstacle's x-centre. The detour
 * clearance ({@link DETOUR_CLEARANCE}) is added on top of the
 * obstacle's padded extent so the bezier's curvature doesn't dip back
 * into the obstacle on the smoothed cubic.
 *
 * Exported for direct unit testing of the waypoint geometry.
 */
export const pickDetourWaypoint = (
  source: Point,
  target: Point,
  obstacle: Box,
  padding: number = OBSTACLE_PADDING
): Point => {
  const padded = padBox(obstacle, padding);
  const midY = (source.y + target.y) / 2;
  // Two candidate waypoints: directly above or directly below the
  // padded box, with extra clearance to keep the bezier curvature
  // from re-entering.
  const above: Point = {
    x: padded.x + padded.width / 2,
    y: padded.y - DETOUR_CLEARANCE,
  };
  const below: Point = {
    x: padded.x + padded.width / 2,
    y: padded.y + padded.height + DETOUR_CLEARANCE,
  };
  // Pick the side whose y is closer to the source→target midpoint —
  // the shorter detour visually. Equality goes to "above" arbitrarily
  // so the function is deterministic.
  const distAbove = Math.abs(above.y - midY);
  const distBelow = Math.abs(below.y - midY);
  return distBelow < distAbove ? below : above;
};

/**
 * Phase C implementation: route the edge using visibility-graph + A\*
 * over obstacle corners. Falls back to the default bezier when no
 * obstacle is on the path or when A\* fails (source/target inside an
 * obstacle).
 *
 * The function is total (never throws) and pure (no side effects, no
 * store reads). Degenerate inputs:
 *   - `source === target`: emits a no-op `M sx,sy L sx,sy`.
 *   - empty obstacle list: default cubic bezier from source to target.
 *   - no blockers on the default bezier: also default cubic bezier
 *     (skip the A\* cost when the straight bezier is already free).
 */
export const routeEdge = (input: RoutingInput): EdgeRoute => {
  const { source, target, obstacles, obstaclePadding = OBSTACLE_PADDING } = input;
  // Zero-length segment — emit a degenerate no-op path.
  if (source.x === target.x && source.y === target.y) {
    return {
      d: `M${source.x},${source.y} L${source.x},${source.y}`,
      waypoints: [source, target],
    };
  }
  const blockers = findBlockingObstacles(source, target, obstacles, obstaclePadding);
  if (blockers.length === 0) {
    // Fast path — straight bezier is already obstacle-free, no need
    // to pay for A\*.
    return {
      d: defaultBezierPath(source, target),
      waypoints: [source, target],
    };
  }
  // Run the full visibility-graph A\* against the COMPLETE obstacle
  // set (not just the blockers). The A\* must see every obstacle so
  // its candidate waypoints don't accidentally cut through a non-
  // blocking sibling.
  const path = findVisibilityPath(source, target, obstacles, obstaclePadding);
  if (!path || path.length < 2) {
    // A\* couldn't find a route — fall back to the bezier so the edge
    // still renders (better than no edge at all).
    return {
      d: defaultBezierPath(source, target),
      waypoints: [source, target],
    };
  }
  if (path.length === 2) {
    // A\* found a direct line — same as the default bezier.
    return {
      d: defaultBezierPath(source, target),
      waypoints: [source, target],
    };
  }
  return {
    d: bezierThroughWaypoints(path),
    waypoints: path,
  };
};

// -- Public re-exports ----------------------------------------------------
//
// The router's surface used to live entirely in this file. After the
// Session-164 split the primitives moved to the leaf modules; re-export them
// here so `@/domain/edgeRouting` stays the single import site for every
// consumer (the hook, the flow types, the tests) — no call-site churn.

export {
  bezierThroughWaypoint,
  bezierThroughWaypoints,
  bezierThroughWaypointsSided,
  defaultBezierPath,
  sampleDefaultBezier,
  sampleSidedBezier,
  sideBezierSegment,
} from './edgeBezier';
export type { Box, Point } from './edgeGeometry';
export { DETOUR_CLEARANCE, OBSTACLE_PADDING, segmentIntersectsBox } from './edgeGeometry';
export type { VisibilityGraph } from './edgeVisibilityGraph';
export { aStarOnGraph, buildVisibilityGraph, findVisibilityPath } from './edgeVisibilityGraph';
