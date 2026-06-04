import { describe, expect, it } from 'vitest';
import {
  ARROW_HALF_WIDTH,
  ARROW_LENGTH,
  ARROW_TIP_GAP,
  ARROW_TRIANGLE_D,
  arrowheadOnPath,
  arrowheadPlacement,
  arrowheadTransform,
  terminalTangent,
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

describe('terminalTangent', () => {
  it('reads the endpoint + arrival tangent from a single-cubic path', () => {
    // Vertical default bezier: last cubic ends at (0,0), arriving from (0,50).
    expect(terminalTangent('M0,100 C0,50 0,50 0,0')).toEqual({ ex: 0, ey: 0, dx: 0, dy: -50 });
  });

  it('uses the LAST cubic of a multi-segment (routed) path', () => {
    expect(terminalTangent('M0,0 C0,25 50,25 50,50 C50,25 100,25 100,0')).toEqual({
      ex: 100,
      ey: 0,
      dx: 0,
      dy: -25,
    });
  });

  it('captures a diagonal arrival direction', () => {
    expect(terminalTangent('M0,0 C10,10 40,40 50,60')).toEqual({ ex: 50, ey: 60, dx: 10, dy: 20 });
  });

  it('returns null for a path with no cubic (straight line)', () => {
    expect(terminalTangent('M0,0 L100,0')).toBeNull();
  });

  it('returns null when the final cubic is truncated', () => {
    expect(terminalTangent('M0,0 C1,2 3,4')).toBeNull();
  });
});

describe('arrowheadOnPath', () => {
  it('returns null when the edge carries no arrowhead', () => {
    expect(
      arrowheadOnPath({
        show: false,
        path: 'M0,0 C0,0 0,0 0,0',
        sourceX: 0,
        sourceY: 0,
        targetX: 0,
        targetY: 0,
      })
    ).toBeNull();
  });

  it('orients to the path tangent, not the straight chord', () => {
    // The path arrives travelling straight DOWN (tangent (0,+20)); the chord
    // source→target points down-right (100,50). The arrowhead must follow the
    // path tangent (90°) — proving it ignores the chord when the path parses.
    const p = arrowheadOnPath({
      show: true,
      path: 'M0,0 C20,0 100,30 100,50',
      sourceX: 0,
      sourceY: 0,
      targetX: 100,
      targetY: 50,
    });
    expect(p?.angleDeg).toBeCloseTo(90);
    expect(p?.tipX).toBeCloseTo(100);
    // Tip backs off ARROW_TIP_GAP from the endpoint along the tangent.
    expect(p?.tipY).toBeCloseTo(50 - ARROW_TIP_GAP);
  });

  it('falls back to the straight chord when the path has no cubic', () => {
    const opts = { show: true, sourceX: 0, sourceY: 0, targetX: 0, targetY: -100 };
    expect(arrowheadOnPath({ ...opts, path: 'M0,0 L0,-100' })).toEqual(arrowheadPlacement(opts));
  });
});
