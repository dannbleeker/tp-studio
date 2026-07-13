import { describe, expect, it } from 'vitest';
import {
  fanRankByPositions,
  hoverFanActive,
  hoverFanOffsetX,
} from '@/components/canvas/edges/hoverFan';

describe('hoverFanActive', () => {
  it('fans a hovered group of 2+ with a direct route', () => {
    expect(hoverFanActive({ isFanGroupHovered: true, fanCount: 3, routeWaypointCount: 2 })).toBe(
      true
    );
    // No route (direct-routing mode) counts as direct.
    expect(hoverFanActive({ isFanGroupHovered: true, fanCount: 2, routeWaypointCount: 0 })).toBe(
      true
    );
  });

  it('does not fan when not hovered, when lone, or when the route detours', () => {
    expect(hoverFanActive({ isFanGroupHovered: false, fanCount: 3, routeWaypointCount: 2 })).toBe(
      false
    );
    expect(hoverFanActive({ isFanGroupHovered: true, fanCount: 1, routeWaypointCount: 2 })).toBe(
      false
    );
    // A detoured route (>2 waypoints) stays put — fanning it would snap from the
    // obstacle detour to a straight bezier.
    expect(hoverFanActive({ isFanGroupHovered: true, fanCount: 3, routeWaypointCount: 5 })).toBe(
      false
    );
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
