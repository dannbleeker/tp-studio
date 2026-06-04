import { describe, expect, it } from 'vitest';
import { bezierThroughWaypoint, bezierThroughWaypoints } from '@/domain/edgeBezier';
import { padBox, segmentCrossesBoxBounds, segmentsCross } from '@/domain/edgeGeometry';

// These edge-routing geometry primitives are otherwise exercised only
// *transitively* by `edgeRouting.test.ts` (through the full router / A* path).
// Pinning them directly guards the hot-path Liang-Barsky math, the padding
// arithmetic, the multi-waypoint bezier composition, and the segment-crossing
// predicate against silent regressions — each is easy to break with an
// off-by-one and invisible at the router level.

describe('segmentCrossesBoxBounds (inlined strict-interior A* hot path)', () => {
  // Canonical box: x ∈ [10, 30], y ∈ [10, 30].
  const X0 = 10;
  const X1 = 30;
  const Y0 = 10;
  const Y1 = 30;

  it('returns true for a horizontal segment cutting straight through the box', () => {
    expect(segmentCrossesBoxBounds(0, 20, 40, 20, X0, X1, Y0, Y1)).toBe(true);
  });

  it('returns true for a vertical segment cutting straight through the box', () => {
    expect(segmentCrossesBoxBounds(20, 0, 20, 40, X0, X1, Y0, Y1)).toBe(true);
  });

  it('returns true for a diagonal that pierces the interior', () => {
    expect(segmentCrossesBoxBounds(0, 0, 40, 40, X0, X1, Y0, Y1)).toBe(true);
  });

  it('returns true when the segment starts inside the box', () => {
    expect(segmentCrossesBoxBounds(20, 20, 100, 20, X0, X1, Y0, Y1)).toBe(true);
  });

  it('returns false for a horizontal segment passing entirely above the box', () => {
    // dy = 0 → the top/bottom slabs hit the `p === 0 && q < 0` reject branch.
    expect(segmentCrossesBoxBounds(0, 5, 40, 5, X0, X1, Y0, Y1)).toBe(false);
  });

  it('returns false for a vertical segment entirely left of the box', () => {
    // dx = 0 → the left/right slabs hit the `p === 0 && q < 0` reject branch.
    expect(segmentCrossesBoxBounds(5, 0, 5, 40, X0, X1, Y0, Y1)).toBe(false);
  });

  it('returns false for a degenerate box with no width (xmax <= xmin)', () => {
    expect(segmentCrossesBoxBounds(0, 20, 40, 20, 30, 10, Y0, Y1)).toBe(false);
  });

  it('returns false for a degenerate box with no height (ymax <= ymin)', () => {
    expect(segmentCrossesBoxBounds(0, 20, 40, 20, X0, X1, 30, 10)).toBe(false);
  });
});

describe('padBox', () => {
  const box = { x: 10, y: 20, width: 30, height: 40 } as const;

  it('grows the box by `margin` on every side (origin shifts, size +2·margin)', () => {
    expect(padBox(box, 5)).toEqual({ x: 5, y: 15, width: 40, height: 50 });
  });

  it('is the identity at margin 0', () => {
    expect(padBox(box, 0)).toEqual(box);
  });

  it('shrinks the box for a negative margin', () => {
    expect(padBox(box, -4)).toEqual({ x: 14, y: 24, width: 22, height: 32 });
  });
});

describe('bezierThroughWaypoints (multi-waypoint composition)', () => {
  const A = { x: 0, y: 0 } as const;
  const W = { x: 50, y: 50 } as const;
  const B = { x: 100, y: 0 } as const;

  it('throws on fewer than two points (caller error — routing always has 2 endpoints)', () => {
    expect(() => bezierThroughWaypoints([])).toThrow(/at least 2 points/);
    expect(() => bezierThroughWaypoints([A])).toThrow(/at least 2 points/);
  });

  it('collapses to the plain source→target curve for exactly two points', () => {
    // Two points must equal defaultBezierPath — verified here via the single-
    // waypoint sibling for a known shape; the 2-point branch is the same path.
    expect(bezierThroughWaypoints([A, B])).toBe('M0,0 C0,0 100,0 100,0');
  });

  it('composes one cubic per segment with vertical-midpoint control points', () => {
    // Three points ⇒ two cubics; identical to the single-waypoint emitter.
    expect(bezierThroughWaypoints([A, W, B])).toBe(bezierThroughWaypoint(A, W, B));
    expect(bezierThroughWaypoints([A, W, B])).toBe('M0,0 C0,25 50,25 50,50 C50,25 100,25 100,0');
  });

  it('emits N−1 cubic segments for N points', () => {
    const C = { x: 150, y: 50 } as const;
    const path = bezierThroughWaypoints([A, W, B, C]);
    // 4 points → 3 "C" segments after the initial moveto.
    expect(path.match(/C/g)?.length).toBe(3);
    expect(path.startsWith('M0,0')).toBe(true);
    expect(path.endsWith('150,50')).toBe(true);
  });
});

describe('segmentsCross (transversal crossing predicate for #5)', () => {
  const p = (x: number, y: number) => ({ x, y });

  it('is true for a clean diagonal X', () => {
    expect(segmentsCross(p(0, 0), p(10, 10), p(0, 10), p(10, 0))).toBe(true);
  });

  it('is true for a perpendicular cross away from the origin', () => {
    expect(segmentsCross(p(0, 5), p(10, 5), p(5, 0), p(5, 10))).toBe(true);
  });

  it('is FALSE for a shared endpoint (two edges leaving the same node)', () => {
    expect(segmentsCross(p(0, 0), p(10, 10), p(0, 0), p(10, -10))).toBe(false);
  });

  it('is FALSE for a T-touch (one endpoint lands on the other segment)', () => {
    expect(segmentsCross(p(0, 0), p(10, 0), p(5, 0), p(5, 10))).toBe(false);
  });

  it('is FALSE for parallel segments', () => {
    expect(segmentsCross(p(0, 0), p(10, 0), p(0, 5), p(10, 5))).toBe(false);
  });

  it('is FALSE for collinear overlapping segments', () => {
    expect(segmentsCross(p(0, 0), p(10, 0), p(5, 0), p(15, 0))).toBe(false);
  });

  it('is FALSE for disjoint segments', () => {
    expect(segmentsCross(p(0, 0), p(1, 1), p(10, 0), p(11, 1))).toBe(false);
  });

  it('is FALSE when the supporting lines cross but the segments do not reach', () => {
    // Lines y=x and y=10−x meet at (5,5), but segment 1 only runs to (2,2).
    expect(segmentsCross(p(0, 0), p(2, 2), p(0, 10), p(10, 0))).toBe(false);
  });

  it('is symmetric in the two segments', () => {
    const a = p(0, 0);
    const b = p(10, 10);
    const c = p(0, 10);
    const d = p(10, 0);
    expect(segmentsCross(a, b, c, d)).toBe(segmentsCross(c, d, a, b));
  });
});
