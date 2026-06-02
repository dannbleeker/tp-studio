/**
 * Edge-routing geometry leaf — the shared types, constants, and box/segment
 * primitives the routing modules build on. Deliberately dependency-free (it
 * imports nothing from `edgeRouting` / `edgeBezier` / `edgeVisibilityGraph` /
 * `edgeSides`), so it sits at the bottom of the routing module graph and the
 * higher layers can all import from it without forming a cycle.
 *
 * Split out of `edgeRouting.ts` (Session 164). Pure geometry — no store, no
 * React, no UI-library dependency.
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
 * Default obstacle padding. The hit-test treats each obstacle box as
 * if it were `OBSTACLE_PADDING` px wider on every side — gives a
 * "no-fly zone" so the routed curve clears the node body with room
 * for the stroke + label band. Per the proposal's question #4: 8 px.
 */
export const OBSTACLE_PADDING = 8;

/**
 * Detour clearance — extra distance between the waypoint and the
 * obstacle's nearest edge in the Phase B single-obstacle heuristic.
 * Larger values produce more dramatic curves that read clearly as
 * "going around"; smaller values hug the obstacle more tightly.
 * 16 px matches the visual feel of the radial router's deflection
 * margin.
 */
export const DETOUR_CLEARANCE = 16;

/**
 * Exact line-segment-vs-axis-aligned-box intersection test (Liang-
 * Barsky parametric clipping). Returns `true` when the segment from
 * `s` to `t` enters and exits the box's interior at some t ∈ [0, 1].
 * Endpoints touching the boundary count as intersection.
 *
 * This is the top-left+size sibling of
 * `radialEdgeRouting.lineIntersectsBox` — both modules implement the
 * same math; the difference is the box representation each one
 * consumes (top-left vs. centre+half-extents).
 */
export const segmentIntersectsBox = (s: Point, t: Point, box: Box): boolean => {
  const xmin = box.x;
  const xmax = box.x + box.width;
  const ymin = box.y;
  const ymax = box.y + box.height;
  const dx = t.x - s.x;
  const dy = t.y - s.y;
  let tEnter = 0;
  let tExit = 1;
  const ps = [-dx, dx, -dy, dy];
  const qs = [s.x - xmin, xmax - s.x, s.y - ymin, ymax - s.y];
  for (let i = 0; i < 4; i++) {
    const p = ps[i];
    const q = qs[i];
    if (p === undefined || q === undefined) continue;
    if (p === 0) {
      if (q < 0) return false;
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > tExit) return false;
        if (r > tEnter) tEnter = r;
      } else {
        if (r < tEnter) return false;
        if (r < tExit) tExit = r;
      }
    }
  }
  return tEnter <= tExit;
};

/**
 * Strict-interior segment-vs-box test, inlined for the visibility-
 * graph hot path. Operates on flat `xmin/xmax/ymin/ymax` numbers
 * rather than `Box` objects so the inner A\* loop doesn't allocate
 * per call — that single change moves us from ~500 ms to <50 ms on
 * a 50-edge × 50-obstacle benchmark.
 *
 * Logical equivalent of {@link segmentIntersectsBox} on a box shrunk
 * by EPS on every side. Corner-on-padded-boundary cases pass through
 * (the EPS shrink keeps corner→corner edges along a shared boundary
 * visible to each other).
 */
export const segmentCrossesBoxBounds = (
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  xmin: number,
  xmax: number,
  ymin: number,
  ymax: number
): boolean => {
  if (xmax <= xmin || ymax <= ymin) return false;
  const dx = tx - sx;
  const dy = ty - sy;
  let tEnter = 0;
  let tExit = 1;
  // Iteration unrolled — V8 doesn't auto-unroll a 4-iter loop here and
  // the inner branch is hot enough that the saved loop overhead is
  // measurable on the 50-obstacle benchmark.
  {
    const p = -dx;
    const q = sx - xmin;
    if (p === 0) {
      if (q < 0) return false;
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > tExit) return false;
        if (r > tEnter) tEnter = r;
      } else {
        if (r < tEnter) return false;
        if (r < tExit) tExit = r;
      }
    }
  }
  {
    const p = dx;
    const q = xmax - sx;
    if (p === 0) {
      if (q < 0) return false;
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > tExit) return false;
        if (r > tEnter) tEnter = r;
      } else {
        if (r < tEnter) return false;
        if (r < tExit) tExit = r;
      }
    }
  }
  {
    const p = -dy;
    const q = sy - ymin;
    if (p === 0) {
      if (q < 0) return false;
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > tExit) return false;
        if (r > tEnter) tEnter = r;
      } else {
        if (r < tEnter) return false;
        if (r < tExit) tExit = r;
      }
    }
  }
  {
    const p = dy;
    const q = ymax - sy;
    if (p === 0) {
      if (q < 0) return false;
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > tExit) return false;
        if (r > tEnter) tEnter = r;
      } else {
        if (r < tEnter) return false;
        if (r < tExit) tExit = r;
      }
    }
  }
  return tEnter <= tExit;
};

/** Pad a box uniformly by `margin` pixels on every side. */
export const padBox = (box: Box, margin: number): Box => ({
  x: box.x - margin,
  y: box.y - margin,
  width: box.width + 2 * margin,
  height: box.height + 2 * margin,
});
