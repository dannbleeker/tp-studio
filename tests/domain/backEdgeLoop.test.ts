import { describe, expect, it } from 'vitest';
import { backEdgeLoopRoute, backEdgeLoopSide } from '@/domain/backEdgeLoop';
import type { Box, Point } from '@/domain/edgeGeometry';

/**
 * Wave 3 item 2 — the bowed back-edge loop geometry. `backEdgeLoopSide` picks a
 * clear side (right by default, left when the right bulge is blocked, null when
 * both are blocked); `backEdgeLoopRoute` builds the single side-bowed cubic +
 * its coarse 3-point polyline.
 */

// Source below the target (the inventory-CRT no-op case): both anchors share an
// x; the loop must bow sideways out of the corridor.
const sourceAnchor: Point = { x: 100, y: 300 };
const targetAnchor: Point = { x: 100, y: 100 };

describe('backEdgeLoopSide', () => {
  it('defaults to the right when both sides are clear', () => {
    expect(backEdgeLoopSide(sourceAnchor, targetAnchor, [], 120)).toBe('right');
  });

  it('picks the left when the right bulge is blocked', () => {
    const rightObstacle: Box = { x: 180, y: 120, width: 80, height: 160 };
    expect(backEdgeLoopSide(sourceAnchor, targetAnchor, [rightObstacle], 120)).toBe('left');
  });

  it('returns null when both bulge sides are blocked', () => {
    const right: Box = { x: 180, y: 120, width: 80, height: 160 };
    const left: Box = { x: -40, y: 120, width: 80, height: 160 };
    expect(backEdgeLoopSide(sourceAnchor, targetAnchor, [right, left], 120)).toBeNull();
  });
});

describe('backEdgeLoopRoute', () => {
  it('keeps the source + target anchors as the route endpoints', () => {
    const { waypoints } = backEdgeLoopRoute(sourceAnchor, targetAnchor, 'right', 120);
    expect(waypoints[0]).toEqual(sourceAnchor);
    expect(waypoints[waypoints.length - 1]).toEqual(targetAnchor);
  });

  it('bows the apex out to the right of the (aligned) anchors', () => {
    const { waypoints } = backEdgeLoopRoute(sourceAnchor, targetAnchor, 'right', 120);
    const apex = waypoints[1]!;
    expect(apex.x).toBeGreaterThan(sourceAnchor.x);
    expect(apex.x).toBe((sourceAnchor.x + targetAnchor.x) / 2 + 120); // midX + reach
  });

  it('mirrors the apex to the left for the left side', () => {
    const { waypoints } = backEdgeLoopRoute(sourceAnchor, targetAnchor, 'left', 120);
    expect(waypoints[1]!.x).toBeLessThan(sourceAnchor.x);
  });

  it('emits a single cubic whose control points sit on the bow side', () => {
    const { d } = backEdgeLoopRoute(sourceAnchor, targetAnchor, 'right', 120);
    expect(d.startsWith('M100,300 C')).toBe(true);
    expect(d).toContain('C220,'); // both control x = anchorX + reach = 220
    expect(d.endsWith('100,100')).toBe(true);
  });
});
