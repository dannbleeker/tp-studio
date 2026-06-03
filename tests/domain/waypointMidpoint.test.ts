import { describe, expect, it } from 'vitest';
import { waypointMidpoint } from '@/domain/edgeGeometry';

/**
 * `waypointMidpoint` anchors an edge's mid-label on a routed (bent) path by
 * walking the polyline's arc length — so the label rides the detour instead of
 * sitting at the straight start→end midpoint (which can land inside an obstacle
 * the route bends around). Pinned here as a pure function.
 */
describe('waypointMidpoint', () => {
  it('returns the segment midpoint for a 2-point straight line', () => {
    expect(
      waypointMidpoint([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ])
    ).toEqual({ x: 5, y: 0 });
  });

  it('walks total arc length, not the straight start→end midpoint, on a bend', () => {
    // L-shape (0,0) → (0,10) → (10,10): total length 20, half = 10 → exactly the
    // corner (0,10). The naive straight start→end midpoint would be (5,5).
    expect(
      waypointMidpoint([
        { x: 0, y: 0 },
        { x: 0, y: 10 },
        { x: 10, y: 10 },
      ])
    ).toEqual({ x: 0, y: 10 });
  });

  it('interpolates within the segment that crosses the halfway mark', () => {
    // Three 10-long segments, total 30, half = 15 → 5 into the second segment.
    expect(
      waypointMidpoint([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 },
        { x: 30, y: 0 },
      ])
    ).toEqual({ x: 15, y: 0 });
  });

  it('handles degenerate inputs (empty, single, zero-length)', () => {
    expect(waypointMidpoint([])).toEqual({ x: 0, y: 0 });
    expect(waypointMidpoint([{ x: 3, y: 4 }])).toEqual({ x: 3, y: 4 });
    expect(
      waypointMidpoint([
        { x: 2, y: 2 },
        { x: 2, y: 2 },
      ])
    ).toEqual({ x: 2, y: 2 });
  });
});
