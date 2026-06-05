import { describe, expect, it } from 'vitest';
import { backEdgeLoopPlan, backEdgeLoopRoute } from '@/domain/backEdgeLoop';
import type { Box, Point } from '@/domain/edgeGeometry';

/**
 * Wave 3 item 2/3 — the rail/bracket back-edge loop. `backEdgeLoopPlan` picks a
 * bow side + an obstacle-clearing reach (the side needing the smaller rail; ties
 * left; the reach widens so the rail clears every card the span passes).
 * `backEdgeLoopRoute` builds the 4-point rail polyline (out → down → in).
 */

// Source below the target (the inventory-CRT no-op case): both anchors share an
// x; the loop bows sideways out of the corridor.
const sourceAnchor: Point = { x: 100, y: 300 };
const targetAnchor: Point = { x: 100, y: 100 };
const HALF = 110; // half a NODE_WIDTH card

describe('backEdgeLoopPlan', () => {
  it('with no obstacles, reaches just past the endpoints and defaults left', () => {
    const plan = backEdgeLoopPlan(sourceAnchor, targetAnchor, [], HALF);
    expect(plan.side).toBe('left');
    expect(plan.reach).toBeGreaterThan(HALF); // floor = half + clear margin
  });

  it('picks the side whose rail needs less reach (away from a one-sided obstacle)', () => {
    // A card protruding to the RIGHT, within the loop's vertical span → the right
    // rail would have to swing wider, so the plan bows LEFT.
    const right: Box = { x: 150, y: 120, width: 220, height: 80 };
    expect(backEdgeLoopPlan(sourceAnchor, targetAnchor, [right], HALF).side).toBe('left');
  });

  it('widens the reach so the rail clears a card the span passes', () => {
    // A wide card centred on the axis → the left rail must clear its left edge.
    const card: Box = { x: -60, y: 150, width: 320, height: 72 };
    const plan = backEdgeLoopPlan(sourceAnchor, targetAnchor, [card], HALF);
    const railX = 100 - plan.reach; // midX (100) - reach, bowing left
    expect(railX).toBeLessThan(card.x); // rail sits left of the card's left edge
  });

  it('ignores obstacles outside the vertical span', () => {
    const above: Box = { x: -60, y: -400, width: 320, height: 72 };
    const plan = backEdgeLoopPlan(sourceAnchor, targetAnchor, [above], HALF);
    expect(plan.reach).toBe(HALF + 60); // floor only — the far card doesn't widen it
  });
});

describe('backEdgeLoopRoute', () => {
  it('keeps the source + target anchors as the route endpoints', () => {
    const { waypoints } = backEdgeLoopRoute(sourceAnchor, targetAnchor, 'left', 200);
    expect(waypoints[0]).toEqual(sourceAnchor);
    expect(waypoints[waypoints.length - 1]).toEqual(targetAnchor);
  });

  it('runs a straight side rail (two interior points share the bowed x)', () => {
    const { waypoints } = backEdgeLoopRoute(sourceAnchor, targetAnchor, 'left', 200);
    expect(waypoints).toHaveLength(4);
    const railX = waypoints[1]!.x;
    expect(railX).toBe(waypoints[2]!.x); // vertical rail
    expect(railX).toBe(100 - 200); // midX - reach (left)
  });

  it('mirrors the rail to the right for the right side', () => {
    const { waypoints } = backEdgeLoopRoute(sourceAnchor, targetAnchor, 'right', 200);
    expect(waypoints[1]!.x).toBe(100 + 200);
  });

  it('emits a path that starts at the source and ends at the target', () => {
    const { d } = backEdgeLoopRoute(sourceAnchor, targetAnchor, 'left', 200);
    expect(d.startsWith('M100,300')).toBe(true);
    expect(d.endsWith('100,100')).toBe(true);
  });
});
