import { describe, expect, it } from 'vitest';
import {
  ARROW_HALF_WIDTH,
  ARROW_LENGTH,
  ARROW_TIP_GAP,
  ARROW_TRIANGLE_D,
  arrowheadPlacement,
  arrowheadTransform,
} from '@/components/canvas/edges/edgeArrowhead';

describe('arrowheadPlacement', () => {
  it('returns null when the edge should not carry an arrowhead', () => {
    expect(
      arrowheadPlacement({ show: false, sourceX: 0, sourceY: 0, targetX: 100, targetY: 0 })
    ).toBeNull();
  });

  it('orients along a horizontal cause→effect edge (left→right ⇒ 0°)', () => {
    const p = arrowheadPlacement({ show: true, sourceX: 0, sourceY: 0, targetX: 100, targetY: 0 });
    expect(p).not.toBeNull();
    expect(p?.angleDeg).toBeCloseTo(0);
    // Tip sits ARROW_TIP_GAP before the target *along the edge*, so the stroke
    // runs out of the tip into the box.
    expect(p?.tipX).toBeCloseTo(100 - ARROW_TIP_GAP);
    expect(p?.tipY).toBeCloseTo(0);
  });

  it('orients along a bottom-up CRT edge (cause below ⇒ points up, -90°)', () => {
    // Target above the source (smaller y) → direction (0,-1) → -90°; the tip
    // backs off toward the source (larger y).
    const p = arrowheadPlacement({
      show: true,
      sourceX: 50,
      sourceY: 200,
      targetX: 50,
      targetY: 0,
    });
    expect(p?.angleDeg).toBeCloseTo(-90);
    expect(p?.tipX).toBeCloseTo(50);
    expect(p?.tipY).toBeCloseTo(ARROW_TIP_GAP);
  });

  it('orients along a diagonal edge', () => {
    const p = arrowheadPlacement({
      show: true,
      sourceX: 0,
      sourceY: 0,
      targetX: 100,
      targetY: 100,
    });
    expect(p?.angleDeg).toBeCloseTo(45);
  });

  it('does not divide by zero for a degenerate (zero-length) edge', () => {
    const p = arrowheadPlacement({
      show: true,
      sourceX: 10,
      sourceY: 10,
      targetX: 10,
      targetY: 10,
    });
    expect(p).not.toBeNull();
    expect(Number.isFinite(p?.tipX ?? Number.NaN)).toBe(true);
    expect(Number.isFinite(p?.tipY ?? Number.NaN)).toBe(true);
    expect(Number.isFinite(p?.angleDeg ?? Number.NaN)).toBe(true);
  });
});

describe('ARROW_TRIANGLE_D + arrowheadTransform', () => {
  it('builds the triangle from the size constants (tip at the origin)', () => {
    expect(ARROW_TRIANGLE_D).toBe(
      `M 0 0 L ${-ARROW_LENGTH} ${-ARROW_HALF_WIDTH} L ${-ARROW_LENGTH} ${ARROW_HALF_WIDTH} z`
    );
  });

  it('emits a translate+rotate transform for a placement', () => {
    expect(arrowheadTransform({ tipX: 12, tipY: 34, angleDeg: 45 })).toBe(
      'translate(12 34) rotate(45)'
    );
  });
});
