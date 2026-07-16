import { describe, expect, it } from 'vitest';
import {
  fanPerpendicularOffset,
  fanRankByAngle,
  fanRankByPositions,
  hoverFanActive,
  hoverFanOffsetX,
  offsetLastWaypoint,
} from '@/components/canvas/edges/hoverFan';

describe('hoverFanActive', () => {
  it('fans a hovered group of 2+', () => {
    expect(hoverFanActive({ isFanGroupHovered: true, fanCount: 3 })).toBe(true);
    expect(hoverFanActive({ isFanGroupHovered: true, fanCount: 2 })).toBe(true);
  });

  it('does not fan when not hovered or when the edge is alone at its target', () => {
    expect(hoverFanActive({ isFanGroupHovered: false, fanCount: 3 })).toBe(false);
    expect(hoverFanActive({ isFanGroupHovered: true, fanCount: 1 })).toBe(false);
  });

  // Session 206 — the route-shape gate is gone. It only ever existed because the
  // fan replaced a routed path with a straight bezier, which erased an obstacle
  // detour; a detour is now fanned by nudging its final waypoint and rebuilding
  // (see `offsetLastWaypoint`), so route shape is no longer the fan's business.
  it('no longer cares about the route shape — a detour fans like anything else', () => {
    expect(hoverFanActive({ isFanGroupHovered: true, fanCount: 3 })).toBe(true);
  });
});

describe('hoverFanOffsetX', () => {
  it('spreads symmetrically around the shared endpoint (middle of an odd group unmoved)', () => {
    expect(hoverFanOffsetX(0, 3, 16)).toBe(-16);
    expect(hoverFanOffsetX(1, 3, 16)).toBe(0);
    expect(hoverFanOffsetX(2, 3, 16)).toBe(16);
  });

  it('splits an even group either side of the endpoint', () => {
    expect(hoverFanOffsetX(0, 2, 16)).toBe(-8);
    expect(hoverFanOffsetX(1, 2, 16)).toBe(8);
  });
});

describe('fanRankByPositions', () => {
  it('ranks left-to-right by source X, independent of id order', () => {
    // Ids sort C < B < A, but positions place A leftmost — the rank follows X.
    const siblings = [
      { id: 'A', x: 10 },
      { id: 'B', x: 20 },
      { id: 'C', x: 30 },
    ];
    expect(fanRankByPositions('A', siblings)).toBe(0);
    expect(fanRankByPositions('B', siblings)).toBe(1);
    expect(fanRankByPositions('C', siblings)).toBe(2);
  });

  it('is crossing-free even when the id order is the reverse of the layout', () => {
    // Source ids 'a' < 'b' < 'c' but laid out right-to-left — the old sourceId
    // sort would cross; the position sort assigns the left slot to the left source.
    const siblings = [
      { id: 'a', x: 90 },
      { id: 'b', x: 50 },
      { id: 'c', x: 10 },
    ];
    expect(fanRankByPositions('c', siblings)).toBe(0);
    expect(fanRankByPositions('b', siblings)).toBe(1);
    expect(fanRankByPositions('a', siblings)).toBe(2);
  });

  it('breaks an X tie deterministically by id', () => {
    const siblings = [
      { id: 'b', x: 40 },
      { id: 'a', x: 40 },
    ];
    expect(fanRankByPositions('a', siblings)).toBe(0);
    expect(fanRankByPositions('b', siblings)).toBe(1);
  });

  it('returns -1 when the source is not among the siblings', () => {
    expect(fanRankByPositions('z', [{ id: 'a', x: 10 }])).toBe(-1);
  });
});

// Session 206 — the radial half of the fan.
describe('fanRankByAngle', () => {
  const target = { x: 0, y: 0 };

  it('ranks by the angle each source approaches the target from', () => {
    // Around the hub, counter-clockwise from due east: E(0), S(π/2), W(π), N(-π/2).
    // atan2 returns (-π, π], so N sorts first, then E, then S, then W.
    const siblings = [
      { id: 'east', x: 100, y: 0 },
      { id: 'south', x: 0, y: 100 },
      { id: 'west', x: -100, y: 0 },
      { id: 'north', x: 0, y: -100 },
    ];
    expect(fanRankByAngle('north', siblings, target)).toBe(0);
    expect(fanRankByAngle('east', siblings, target)).toBe(1);
    expect(fanRankByAngle('south', siblings, target)).toBe(2);
    expect(fanRankByAngle('west', siblings, target)).toBe(3);
  });

  it('separates sources that share an X but arrive from opposite sides', () => {
    // The exact case the lateral-X rank cannot express: same X, opposite approach.
    // X-order would tie these; angle-order splits them.
    const siblings = [
      { id: 'above', x: 0, y: -100 },
      { id: 'below', x: 0, y: 100 },
    ];
    expect(fanRankByAngle('above', siblings, target)).toBe(0);
    expect(fanRankByAngle('below', siblings, target)).toBe(1);
    // For contrast: by X alone they only separate on the id tiebreak.
    expect(
      fanRankByPositions('above', [
        { id: 'above', x: 0 },
        { id: 'below', x: 0 },
      ])
    ).toBe(0);
  });

  it('breaks an angle tie deterministically by id', () => {
    const siblings = [
      { id: 'b', x: 50, y: 50 },
      { id: 'a', x: 100, y: 100 }, // same bearing from the hub, further out
    ];
    expect(fanRankByAngle('a', siblings, target)).toBe(0);
    expect(fanRankByAngle('b', siblings, target)).toBe(1);
  });

  it('returns -1 when the source is not among the siblings', () => {
    expect(fanRankByAngle('z', [{ id: 'a', x: 10, y: 10 }], target)).toBe(-1);
  });
});

describe('fanPerpendicularOffset', () => {
  it('reproduces the lateral-X spread for a flow layout’s due-north approach', () => {
    // A cause below its effect arrives heading up; the perpendicular of "up" is
    // lateral X — so the generalised gesture IS the fan's original behaviour.
    const from = { x: 0, y: 100 };
    const to = { x: 0, y: 0 };
    expect(fanPerpendicularOffset(from, to, 16)).toEqual({ x: 16, y: 0 });
    expect(fanPerpendicularOffset(from, to, -16)).toEqual({ x: -16, y: 0 });
  });

  it('spreads across the approach for an edge arriving horizontally', () => {
    // Arriving heading east → the perpendicular is vertical, not lateral X.
    const out = fanPerpendicularOffset({ x: -100, y: 0 }, { x: 0, y: 0 }, 16);
    expect(out.x).toBeCloseTo(0);
    expect(out.y).toBeCloseTo(16);
  });

  it('returns the point unchanged for a zero-length approach', () => {
    const p = { x: 5, y: 5 };
    expect(fanPerpendicularOffset(p, p, 16)).toEqual(p);
  });

  it('keeps the offset magnitude regardless of the approach length', () => {
    const near = fanPerpendicularOffset({ x: 0, y: 10 }, { x: 0, y: 0 }, 16);
    const far = fanPerpendicularOffset({ x: 0, y: 1000 }, { x: 0, y: 0 }, 16);
    expect(near).toEqual(far); // a unit normal, not a proportional one
  });
});

describe('offsetLastWaypoint', () => {
  it('nudges only the final point, preserving the detour', () => {
    const waypoints = [
      { x: 0, y: 0 },
      { x: 50, y: 40 }, // the detour corner the router computed
      { x: 100, y: 100 },
    ];
    expect(offsetLastWaypoint(waypoints, 16)).toEqual([
      { x: 0, y: 0 },
      { x: 50, y: 40 },
      { x: 116, y: 100 },
    ]);
  });

  it('does not mutate the route’s own waypoints', () => {
    const waypoints = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ];
    const out = offsetLastWaypoint(waypoints, 16);
    expect(waypoints[1]).toEqual({ x: 100, y: 100 }); // the cached route is shared
    expect(out[1]).toEqual({ x: 116, y: 100 });
  });

  it('is a no-op on an empty list', () => {
    expect(offsetLastWaypoint([], 16)).toEqual([]);
  });
});
