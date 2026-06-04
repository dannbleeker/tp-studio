import { describe, expect, it } from 'vitest';
import { bezierThroughWaypoint, bezierThroughWaypoints } from '@/domain/edgeBezier';
import { padBox, segmentCrossesBoxBounds } from '@/domain/edgeGeometry';

// These three primitives live in the edge-routing geometry leaves but are only
// exercised *transitively* by `edgeRouting.test.ts` (through the full router /
// A* path). Pinning them directly guards the hot-path Liang-Barsky math, the
// padding arithmetic, and the multi-waypoint bezier composition against silent
// regressions — each is easy to break with an off-by-one and invisible at the
// router level until a curve visibly clips a node.

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
