/**
 * Unit tests for `selectEdgeSides` (Feature #5 — 4-side anchoring).
 *
 * The helper is pure geometry: given two boxes, the layout axis, and the
 * obstacle set, it picks which side each endpoint exits / enters. The
 * policy is "prefer flow direction" — the facing pair along the main axis
 * wins unless an alternative is clearly shorter (by ≥ SIDE_SWITCH_MARGIN)
 * or the preferred straight shot is blocked.
 *
 * Boxes are top-left + size; all fixtures use 100×100 boxes for easy
 * mental arithmetic. Anchors are mid-side points, so they come out as
 * exact integers — safe to assert with `toEqual`.
 */

import { describe, expect, it } from 'vitest';
import type { Box } from '@/domain/edgeRouting';
import { SIDE_SWITCH_MARGIN, selectEdgeSides, sideAnchor } from '@/domain/edgeSides';

const box = (x: number, y: number): Box => ({ x, y, width: 100, height: 100 });

describe('sideAnchor', () => {
  it('returns the mid-point of each requested side', () => {
    const b: Box = { x: 10, y: 20, width: 100, height: 40 };
    expect(sideAnchor(b, 'top')).toEqual({ x: 60, y: 20 });
    expect(sideAnchor(b, 'bottom')).toEqual({ x: 60, y: 60 });
    expect(sideAnchor(b, 'left')).toEqual({ x: 10, y: 40 });
    expect(sideAnchor(b, 'right')).toEqual({ x: 110, y: 40 });
  });
});

describe('selectEdgeSides — preferred pair by relative position', () => {
  it('vertical axis, target below → source bottom / target top', () => {
    const sel = selectEdgeSides({
      sourceBox: box(0, 0),
      targetBox: box(0, 300),
      axis: 'vertical',
      obstacles: [],
    });
    expect(sel.sourceSide).toBe('bottom');
    expect(sel.targetSide).toBe('top');
    expect(sel.sourceAnchor).toEqual({ x: 50, y: 100 });
    expect(sel.targetAnchor).toEqual({ x: 50, y: 300 });
  });

  it('vertical axis, target above → source top / target bottom (the BT fix)', () => {
    const sel = selectEdgeSides({
      sourceBox: box(0, 300),
      targetBox: box(0, 0),
      axis: 'vertical',
      obstacles: [],
    });
    expect(sel.sourceSide).toBe('top');
    expect(sel.targetSide).toBe('bottom');
    expect(sel.sourceAnchor).toEqual({ x: 50, y: 300 });
    expect(sel.targetAnchor).toEqual({ x: 50, y: 100 });
  });

  it('horizontal axis, target right → source right / target left', () => {
    const sel = selectEdgeSides({
      sourceBox: box(0, 0),
      targetBox: box(300, 0),
      axis: 'horizontal',
      obstacles: [],
    });
    expect(sel.sourceSide).toBe('right');
    expect(sel.targetSide).toBe('left');
    expect(sel.sourceAnchor).toEqual({ x: 100, y: 50 });
    expect(sel.targetAnchor).toEqual({ x: 300, y: 50 });
  });

  it('horizontal axis, target left → source left / target right', () => {
    const sel = selectEdgeSides({
      sourceBox: box(300, 0),
      targetBox: box(0, 0),
      axis: 'horizontal',
      obstacles: [],
    });
    expect(sel.sourceSide).toBe('left');
    expect(sel.targetSide).toBe('right');
  });
});

describe('selectEdgeSides — "prefer flow direction" margin', () => {
  it('keeps the preferred pair when an alternative is shorter by LESS than the margin', () => {
    // target(400,0): the cross-axis (right/left) shot is ~112px shorter than
    // the vertical preferred (~412px). That clears the OLD 60px margin (would
    // have cornered) but NOT the new 150px one — so the flow-axis default now
    // holds, which is the whole point of the Session-146 bump.
    const sel = selectEdgeSides({
      sourceBox: box(0, 0),
      targetBox: box(400, 0),
      axis: 'vertical',
      obstacles: [],
    });
    expect(sel.sourceSide).toBe('bottom');
    expect(sel.targetSide).toBe('top');
  });

  it('switches to the cross-axis pair when it is shorter by MORE than the margin', () => {
    // Wide 300px boxes far apart on the same level: preferred vertical len
    // ~608px, cross-axis (right/left) len ~300 — shorter by ~308 > 150, so it
    // still corners. (100px boxes can't beat the 150px margin on length alone,
    // since a side-switch saves at most ~one box-width — which is exactly why
    // normally-sized siblings now stay vertical.)
    const wide = (x: number, y: number): Box => ({ x, y, width: 300, height: 100 });
    const sel = selectEdgeSides({
      sourceBox: wide(0, 0),
      targetBox: wide(600, 0),
      axis: 'vertical',
      obstacles: [],
    });
    expect(sel.sourceSide).toBe('right');
    expect(sel.targetSide).toBe('left');
  });

  it('exposes the margin constant', () => {
    expect(SIDE_SWITCH_MARGIN).toBe(150);
  });

  it('keeps a different-rank child entered on the flow axis (no side-entry)', () => {
    // Goal-tree shape: a wide child sits BELOW + far to the right of its parent
    // (different ranks — no vertical overlap). A cross-side entry into the
    // parent's RIGHT would be shorter, but the parent must still be entered on
    // its flow-axis BOTTOM (Dann: "it looks wrong that this enters in the side").
    const wide = (x: number, y: number): Box => ({ x, y, width: 300, height: 100 });
    const sel = selectEdgeSides({
      sourceBox: wide(600, 300),
      targetBox: wide(0, 0),
      axis: 'vertical',
      obstacles: [],
    });
    expect(sel.targetSide).toBe('bottom');
  });

  it('still allows the cross-axis entry for SAME-rank neighbours', () => {
    // The wide same-level case from above stays cornered — when the boxes share
    // a rank the cross axis IS the natural facing, so the guard doesn't apply.
    const wide = (x: number, y: number): Box => ({ x, y, width: 300, height: 100 });
    const sel = selectEdgeSides({
      sourceBox: wide(0, 0),
      targetBox: wide(600, 0),
      axis: 'vertical',
      obstacles: [],
    });
    expect(sel.targetSide).toBe('left');
  });
});

describe('selectEdgeSides — obstacle avoidance', () => {
  const sourceBox = box(0, 0);
  const targetBox = box(100, 300); // target below-and-right; preferred is shortest

  it('uses the preferred pair when its straight shot is clear', () => {
    const sel = selectEdgeSides({ sourceBox, targetBox, axis: 'vertical', obstacles: [] });
    expect(sel.sourceSide).toBe('bottom');
    expect(sel.targetSide).toBe('top');
  });

  it('detours to an unblocked side when the preferred shot is blocked', () => {
    // A small box straddling the preferred (50,100)→(150,300) diagonal at
    // its upper portion. The cross (x=100 vertical) and the right/top
    // L-pair both clear it; the shorter unblocked one (right/top) wins.
    const obstacle: Box = { x: 60, y: 130, width: 30, height: 40 };
    const sel = selectEdgeSides({
      sourceBox,
      targetBox,
      axis: 'vertical',
      obstacles: [obstacle],
    });
    expect(sel.sourceSide).not.toBe('bottom'); // moved off the blocked preferred
    expect(sel.sourceSide).toBe('right');
    expect(sel.targetSide).toBe('top');
  });

  it('falls back to the preferred pair when every candidate is blocked', () => {
    // A wide band across the whole gap blocks all four candidate segments.
    const wall: Box = { x: -100, y: 120, width: 400, height: 160 };
    const sel = selectEdgeSides({
      sourceBox: box(0, 0),
      targetBox: box(0, 300),
      axis: 'vertical',
      obstacles: [wall],
    });
    expect(sel.sourceSide).toBe('bottom');
    expect(sel.targetSide).toBe('top');
  });
});

describe('selectEdgeSides — determinism', () => {
  it('is pure: repeated calls return an equal selection', () => {
    const input = {
      sourceBox: box(0, 0),
      targetBox: box(200, 200),
      axis: 'vertical' as const,
      obstacles: [],
    };
    expect(selectEdgeSides(input)).toEqual(selectEdgeSides(input));
  });
});

describe('selectEdgeSides — junctor override', () => {
  it('forces the target to the circle override and varies only the source side', () => {
    // Cause (source) sits below the junctor circle, so it exits its TOP
    // and the target anchor is pinned to the override point.
    const override = { x: 50, y: 135 };
    const sel = selectEdgeSides({
      sourceBox: box(0, 400),
      targetBox: box(0, 0),
      axis: 'vertical',
      obstacles: [],
      targetAnchorOverride: override,
    });
    expect(sel.targetSide).toBe('bottom');
    expect(sel.targetAnchor).toEqual(override);
    expect(sel.sourceSide).toBe('top');
    expect(sel.sourceAnchor).toEqual({ x: 50, y: 400 });
  });

  it('drops the source straight down when the circle sits directly below', () => {
    const override = { x: 50, y: 420 };
    const sel = selectEdgeSides({
      sourceBox: box(0, 0),
      targetBox: box(0, 300),
      axis: 'vertical',
      obstacles: [],
      targetAnchorOverride: override,
    });
    expect(sel.sourceSide).toBe('bottom');
    expect(sel.targetSide).toBe('bottom');
    expect(sel.targetAnchor).toEqual(override);
  });
});
