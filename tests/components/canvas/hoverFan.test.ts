import { describe, expect, it } from 'vitest';
import { hoverFanActive, hoverFanOffsetX } from '@/components/canvas/edges/hoverFan';

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
