import { describe, expect, it } from 'vitest';
import { type EdgeStyleFlags, resolveEdgeVisuals } from '@/components/canvas/edges/edgeVisuals';
import { EDGE_PALETTES } from '@/domain/tokens';

const PAL = EDGE_PALETTES.default;
const MUTEX = '#dc2626';
const SPLICE = '#6366f1';
const BACK_EDGE = '#ea580c';

const base: EdgeStyleFlags = {
  isDropTarget: false,
  isMutex: false,
  selected: false,
  isJunctorGroup: false,
  isBackEdge: false,
  isNoteEdge: false,
  isHoverActive: false,
};
const f = (over: Partial<EdgeStyleFlags>): EdgeStyleFlags => ({ ...base, ...over });

describe('resolveEdgeVisuals', () => {
  it('default edge: palette stroke, width 1.5, no dash, no glow', () => {
    expect(resolveEdgeVisuals(base, PAL)).toEqual({
      stroke: PAL.stroke,
      strokeWidth: 1.5,
      strokeDasharray: undefined,
      filter: undefined,
    });
  });

  it('applies the colour priority drop-target → mutex → selected → junctor → default', () => {
    expect(
      resolveEdgeVisuals(f({ isDropTarget: true, isMutex: true, selected: true }), PAL).stroke
    ).toBe(SPLICE);
    expect(resolveEdgeVisuals(f({ isMutex: true, selected: true }), PAL).stroke).toBe(MUTEX);
    expect(resolveEdgeVisuals(f({ selected: true, isJunctorGroup: true }), PAL).stroke).toBe(
      PAL.strokeSelected
    );
    expect(resolveEdgeVisuals(f({ isJunctorGroup: true }), PAL).stroke).toBe(PAL.strokeAnd);
  });

  it('back-edge gets a distinct stroke colour (below selected, above junctor)', () => {
    expect(resolveEdgeVisuals(f({ isBackEdge: true }), PAL).stroke).toBe(BACK_EDGE);
    // Selection still wins; a back-edge that's also a junctor keeps the back-edge colour.
    expect(resolveEdgeVisuals(f({ isBackEdge: true, selected: true }), PAL).stroke).toBe(
      PAL.strokeSelected
    );
    expect(resolveEdgeVisuals(f({ isBackEdge: true, isJunctorGroup: true }), PAL).stroke).toBe(
      BACK_EDGE
    );
  });

  it('sizes the stroke width: selected 3, junctor 1.75, note 1.25, default 1.5', () => {
    expect(resolveEdgeVisuals(f({ selected: true }), PAL).strokeWidth).toBe(3);
    expect(resolveEdgeVisuals(f({ isJunctorGroup: true }), PAL).strokeWidth).toBe(1.75);
    expect(resolveEdgeVisuals(f({ isNoteEdge: true }), PAL).strokeWidth).toBe(1.25);
  });

  it('back-edge / drop-target add +1.5; an active hover adds +1', () => {
    expect(resolveEdgeVisuals(f({ isBackEdge: true }), PAL).strokeWidth).toBe(3); // 1.5 + 1.5
    expect(resolveEdgeVisuals(f({ isDropTarget: true }), PAL).strokeWidth).toBe(3); // 1.5 + 1.5
    expect(resolveEdgeVisuals(f({ isHoverActive: true }), PAL).strokeWidth).toBe(2.5); // 1.5 + 1
  });

  it('dashes: back-edge "6 4" wins over note "2 3"', () => {
    expect(resolveEdgeVisuals(f({ isBackEdge: true }), PAL).strokeDasharray).toBe('6 4');
    expect(resolveEdgeVisuals(f({ isNoteEdge: true }), PAL).strokeDasharray).toBe('2 3');
    expect(resolveEdgeVisuals(f({ isBackEdge: true, isNoteEdge: true }), PAL).strokeDasharray).toBe(
      '6 4'
    );
  });

  it('glow: drop-target wins over selected; hover gets the soft grey glow', () => {
    expect(resolveEdgeVisuals(f({ isDropTarget: true, selected: true }), PAL).filter).toContain(
      SPLICE
    );
    expect(resolveEdgeVisuals(f({ selected: true }), PAL).filter).toContain(PAL.strokeSelected);
    expect(resolveEdgeVisuals(f({ isHoverActive: true }), PAL).filter).toContain('#73737366');
  });

  it('tracks the live palette (colorblind-safe recolours the stroke)', () => {
    expect(resolveEdgeVisuals(base, EDGE_PALETTES.colorblindSafe).stroke).toBe(
      EDGE_PALETTES.colorblindSafe.stroke
    );
  });
});
