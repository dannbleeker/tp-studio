/**
 * Session 170 — Unit tests for `radialRouteForEdge`, the pure core extracted
 * from the `useRadialRoute` hook (itself lifted out of TPEdge).
 *
 * The geometry (`computeRadialEdgePath`, `lineIntersectsBox`, `nodeBoxOf`) is
 * pinned by `radialEdgeRouting.test.ts`; this file pins only the EXTRACTION-
 * specific glue the hook used to do inline:
 *   1. The edge's own source / target nodes are filtered OUT of the obstacle
 *      set (they're the endpoints, not things to route around).
 *   2. A node with no explicit `width` / `height` falls back to the node-size
 *      constants rather than collapsing to a zero-area box.
 *
 * Assertion strategy: a horizontal edge (0,0)→(200,0) has a straight-line label
 * centroid at y=0. An obstacle dead on that line deflects the curve, moving the
 * centroid off y=0 — so `labelY !== 0` is a clean "did it route around this?"
 * probe without re-pinning the bezier math.
 */

import type { Node as RFNode } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import { radialRouteForEdge } from '@/components/canvas/edges/useRadialRoute';
import { NODE_MIN_HEIGHT, NODE_WIDTH } from '@/domain/constants';

/** Minimal RF node — `radialRouteForEdge` reads only id / position / size. */
const node = (
  id: string,
  position: { x: number; y: number },
  size?: { width: number; height: number }
): RFNode =>
  ({
    id,
    position,
    ...(size ? { width: size.width, height: size.height } : {}),
    data: {},
  }) as unknown as RFNode;

const SRC = { x: 0, y: 0 };
const TGT = { x: 200, y: 0 };
const STRAIGHT_LABEL_Y = 0;

describe('radialRouteForEdge', () => {
  it('deflects around a third node sitting on the source→target line', () => {
    // Box centered on the midpoint (100, 0): spans x[80,120] × y[-20,20].
    const obstacle = node('C', { x: 80, y: -20 }, { width: 40, height: 40 });
    const route = radialRouteForEdge('A', 'B', SRC, TGT, [obstacle]);
    expect(route.labelY).not.toBe(STRAIGHT_LABEL_Y);
  });

  it('excludes the source and target nodes from the obstacle set', () => {
    // The SAME on-path box, but tagged with the edge's own endpoint ids — it
    // must be ignored, so the route stays straight (label centroid at y=0).
    const asSource = node('A', { x: 80, y: -20 }, { width: 40, height: 40 });
    const asTarget = node('B', { x: 80, y: -20 }, { width: 40, height: 40 });
    expect(radialRouteForEdge('A', 'B', SRC, TGT, [asSource]).labelY).toBe(STRAIGHT_LABEL_Y);
    expect(radialRouteForEdge('A', 'B', SRC, TGT, [asTarget]).labelY).toBe(STRAIGHT_LABEL_Y);
  });

  it('falls back to the node-size constants when width/height are absent', () => {
    // No explicit size → the helper must build the box from NODE_WIDTH ×
    // NODE_MIN_HEIGHT. Position it so that default-sized box is centered on the
    // midpoint (100, 0); a real (non-zero) box deflects the curve.
    const obstacle = node('C', { x: 100 - NODE_WIDTH / 2, y: 0 - NODE_MIN_HEIGHT / 2 });
    const route = radialRouteForEdge('A', 'B', SRC, TGT, [obstacle]);
    expect(route.labelY).not.toBe(STRAIGHT_LABEL_Y);
  });

  it('returns a straight bezier when there are no obstacles', () => {
    const route = radialRouteForEdge('A', 'B', SRC, TGT, []);
    expect(route.labelY).toBe(STRAIGHT_LABEL_Y);
    expect(route.path).toContain('M0,0');
  });
});
