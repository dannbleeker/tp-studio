/**
 * Session 99 — Unit tests for the radial-mode obstacle-aware edge
 * routing helper. The math lives in `radialEdgeRouting.ts`; this
 * file pins it independently of the TPEdge component.
 *
 * Three concerns to pin:
 *   1. Line-vs-axis-aligned-box intersection (Liang-Barsky).
 *   2. Path emission: cubic Bézier shape, label centroid, deflection
 *      sign / magnitude.
 *   3. Degenerate inputs (no obstacles, zero-length segment).
 *
 * The TPEdge wiring is exercised separately via the existing
 * TPEdge component tests / Playwright e2e.
 */
import {
  type Box,
  computeRadialEdgePath,
  lineIntersectsBox,
  nodeBoxOf,
} from '@/components/canvas/radialEdgeRouting';
import { describe, expect, it } from 'vitest';

describe('lineIntersectsBox', () => {
  const box: Box = { x: 100, y: 100, halfW: 20, halfH: 20 };

  it('returns true when the segment passes through the box', () => {
    expect(lineIntersectsBox({ x: 0, y: 100 }, { x: 200, y: 100 }, box)).toBe(true);
  });

  it('returns false when the segment passes above the box', () => {
    expect(lineIntersectsBox({ x: 0, y: 50 }, { x: 200, y: 50 }, box)).toBe(false);
  });

  it('returns false when the segment passes below the box', () => {
    expect(lineIntersectsBox({ x: 0, y: 150 }, { x: 200, y: 150 }, box)).toBe(false);
  });

  it('returns true when the segment enters via a corner', () => {
    // Diagonal that clips the top-left corner of the box.
    expect(lineIntersectsBox({ x: 70, y: 70 }, { x: 90, y: 90 }, box)).toBe(true);
  });

  it('returns false when both endpoints sit on the same side of the box', () => {
    // Both endpoints to the left of xmin — segment can't cross.
    expect(lineIntersectsBox({ x: 10, y: 80 }, { x: 50, y: 120 }, box)).toBe(false);
  });

  it('returns true when one endpoint is inside the box', () => {
    expect(lineIntersectsBox({ x: 100, y: 100 }, { x: 300, y: 100 }, box)).toBe(true);
  });

  it('returns true when the segment grazes the boundary (touch counts as hit)', () => {
    // Segment runs exactly along the right edge of the box.
    expect(lineIntersectsBox({ x: 120, y: 0 }, { x: 120, y: 200 }, box)).toBe(true);
  });
});

describe('nodeBoxOf', () => {
  it('converts top-left position + size into center+half-extents', () => {
    const b = nodeBoxOf({ x: 100, y: 200 }, 220, 72);
    expect(b).toEqual({ x: 210, y: 236, halfW: 110, halfH: 36 });
  });
});

describe('computeRadialEdgePath', () => {
  const SOURCE = { x: 0, y: 0 };
  const TARGET = { x: 200, y: 0 };

  it('emits a straight-ish cubic bezier with no obstacles', () => {
    const route = computeRadialEdgePath(SOURCE, TARGET, []);
    expect(route.deflected).toBe(false);
    // Path starts at source, ends at target.
    expect(route.path).toMatch(/^M0,0 C/);
    expect(route.path).toMatch(/200,0$/);
    // Label sits on the source-target line (midpoint, undeflected).
    expect(route.labelX).toBeCloseTo(100, 6);
    expect(route.labelY).toBeCloseTo(0, 6);
  });

  it('produces the same path when obstacles sit far off the segment', () => {
    // Obstacle 500 px below — Liang-Barsky says no intersection,
    // so deflection should stay zero.
    const route = computeRadialEdgePath(SOURCE, TARGET, [{ x: 100, y: 500, halfW: 50, halfH: 50 }]);
    expect(route.deflected).toBe(false);
    expect(route.labelY).toBeCloseTo(0, 6);
  });

  it('deflects perpendicular to the segment when an obstacle blocks it', () => {
    // Obstacle centered on the segment at the midpoint. Deflection
    // should be perpendicular (i.e. away from the obstacle along
    // the y-axis for a horizontal source-target axis).
    const route = computeRadialEdgePath(SOURCE, TARGET, [{ x: 100, y: 0, halfW: 30, halfH: 30 }]);
    expect(route.deflected).toBe(true);
    // Label X stays at the midpoint (deflection is purely
    // perpendicular).
    expect(route.labelX).toBeCloseTo(100, 6);
    // Label Y has moved off the line; magnitude is 0.75 * clearance
    // where clearance = hypot(30, 30) + 16 = ~58.43.
    expect(Math.abs(route.labelY)).toBeGreaterThan(40);
  });

  it('deflects away from the obstacle (sign matches geometry)', () => {
    // Obstacle ABOVE the line (y = -10). Deflection direction
    // depends on perpendicular orientation: perp for (0,0)→(200,0)
    // is (0, +1) by the rotation-by-90° convention. Box center has
    // y < midpoint, so projection is negative → sign = +1 → label
    // moves to positive y (below the line).
    const above = computeRadialEdgePath(SOURCE, TARGET, [{ x: 100, y: -10, halfW: 30, halfH: 30 }]);
    expect(above.deflected).toBe(true);
    expect(above.labelY).toBeGreaterThan(0);

    // Mirror: obstacle BELOW the line → label deflects above it.
    const below = computeRadialEdgePath(SOURCE, TARGET, [{ x: 100, y: 10, halfW: 30, halfH: 30 }]);
    expect(below.deflected).toBe(true);
    expect(below.labelY).toBeLessThan(0);
  });

  it('averages deflection across multiple intersecting obstacles', () => {
    const single = computeRadialEdgePath(SOURCE, TARGET, [
      { x: 100, y: -10, halfW: 30, halfH: 30 },
    ]);
    const cluster = computeRadialEdgePath(SOURCE, TARGET, [
      { x: 90, y: -10, halfW: 30, halfH: 30 },
      { x: 110, y: -10, halfW: 30, halfH: 30 },
    ]);
    // Both obstacles sit on the SAME side (above), so deflections
    // share a sign and the average has the same sign + similar
    // magnitude (because the two boxes have identical clearance).
    expect(Math.sign(cluster.labelY)).toBe(Math.sign(single.labelY));
    expect(Math.abs(cluster.labelY)).toBeCloseTo(Math.abs(single.labelY), 2);
  });

  it('honours custom margin (larger margin → larger deflection)', () => {
    const small = computeRadialEdgePath(SOURCE, TARGET, [{ x: 100, y: 0, halfW: 10, halfH: 10 }], {
      margin: 4,
    });
    const big = computeRadialEdgePath(SOURCE, TARGET, [{ x: 100, y: 0, halfW: 10, halfH: 10 }], {
      margin: 64,
    });
    expect(Math.abs(big.labelY)).toBeGreaterThan(Math.abs(small.labelY));
  });

  it('honours custom alpha (controls control-point distance along the segment axis)', () => {
    // Without obstacles, alpha sets where the cubic's control
    // points sit along the line. Path must still start / end at
    // source / target; the difference is visible in the C control
    // points.
    const tight = computeRadialEdgePath(SOURCE, TARGET, [], { alpha: 0.1 });
    const wide = computeRadialEdgePath(SOURCE, TARGET, [], { alpha: 0.45 });
    // Both paths start and end at the same points.
    expect(tight.path.startsWith('M0,0 C')).toBe(true);
    expect(wide.path.startsWith('M0,0 C')).toBe(true);
    // The middle control-point x coordinates differ.
    const tightX = Number(tight.path.match(/C([\d.-]+),/)?.[1]);
    const wideX = Number(wide.path.match(/C([\d.-]+),/)?.[1]);
    expect(tightX).toBeCloseTo(20, 3); // 0.1 * 200
    expect(wideX).toBeCloseTo(90, 3); // 0.45 * 200
  });

  it('returns a no-op path when source equals target', () => {
    const route = computeRadialEdgePath({ x: 50, y: 50 }, { x: 50, y: 50 }, [
      { x: 100, y: 100, halfW: 20, halfH: 20 },
    ]);
    expect(route.deflected).toBe(false);
    expect(route.path).toBe('M50,50 L50,50');
    expect(route.labelX).toBe(50);
    expect(route.labelY).toBe(50);
  });
});
