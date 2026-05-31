/**
 * Unit tests for `computeJunctors` — the pure junctor-geometry helper
 * behind `JunctorOverlay` (Session 138 / goal #1 AND-rendering fix).
 *
 * The overlay used to read target positions imperatively via
 * `flow.getInternalNode` with no subscription to node movement, so the
 * AND/OR/XOR circle stuck to wherever the target sat when the junctor
 * group last changed — it floated off on its own after a re-layout or a
 * drag. The fix reads geometry from the live React Flow store via a
 * `useStore` selector; this pure helper is the computation that selector
 * runs, so the "circle follows its target" property is pinned here.
 */

import { describe, expect, it } from 'vitest';
import { computeJunctors } from '@/components/canvas/edges/JunctorOverlay';
import { JUNCTOR_CENTER_OFFSET_Y } from '@/domain/constants';

type Geo = {
  internals: {
    positionAbsolute: { x: number; y: number };
    handleBounds?: { target?: { position?: string; y: number; height: number }[] | null } | null;
  };
  measured?: { width?: number; height?: number };
};

const node = (x: number, y: number, w = 220, h = 72): Geo => ({
  internals: { positionAbsolute: { x, y } },
  measured: { width: w, height: h },
});

describe('computeJunctors', () => {
  it('centers the circle below the target — (x + w/2, bottom + offset)', () => {
    const groups = [{ id: 'g1', kind: 'AND' as const, targetId: 't1' }];
    const lookup = new Map<string, Geo>([['t1', node(100, 200)]]);
    expect(computeJunctors(groups, (id) => lookup.get(id))).toEqual([
      {
        id: 'g1',
        kind: 'AND',
        cx: 210, // 100 + 220/2
        tx: 210,
        ty: 272, // 200 + 72
        cy: 272 + JUNCTOR_CENTER_OFFSET_Y,
      },
    ]);
  });

  it('anchors to the bottom handle connection point when handle bounds exist', () => {
    // React Flow terminates the converging cause-edges at the bottom handle,
    // which sits below the measured box (the h-5 handle). The junctor must
    // follow that point — not the box bottom — or the cause-edges stop short of
    // the circle (the "AND/OR/XOR edges miss the circle" bug).
    const groups = [{ id: 'g1', kind: 'AND' as const, targetId: 't1' }];
    const withHandle: Geo = {
      internals: {
        positionAbsolute: { x: 100, y: 200 },
        handleBounds: { target: [{ position: 'bottom', y: 72, height: 20 }] },
      },
      measured: { width: 220, height: 72 },
    };
    const out = computeJunctors(groups, () => withHandle);
    // Box bottom would be 200 + 72 = 272; the handle connection point is
    // 200 + 72 + 20 = 292, and the circle + short-line anchor follow it.
    expect(out[0]?.ty).toBe(292);
    expect(out[0]?.cy).toBe(292 + JUNCTOR_CENTER_OFFSET_Y);
  });

  it('tracks the target when its position changes (the floating-circle fix)', () => {
    const groups = [{ id: 'g1', kind: 'AND' as const, targetId: 't1' }];
    const before = computeJunctors(groups, () => node(0, 0));
    const after = computeJunctors(groups, () => node(400, 300));
    expect(before[0]?.cx).toBe(110);
    expect(after[0]?.cx).toBe(510); // 400 + 110 — circle followed the move
    expect(after[0]?.ty).toBe(372); // 300 + 72
  });

  it('skips a group whose target is not (yet) in the lookup', () => {
    const groups = [{ id: 'g1', kind: 'OR' as const, targetId: 'missing' }];
    expect(computeJunctors(groups, () => undefined)).toEqual([]);
  });

  it('falls back to the default node size when measured is absent', () => {
    const groups = [{ id: 'g1', kind: 'XOR' as const, targetId: 't1' }];
    const lookup = new Map<string, Geo>([
      ['t1', { internals: { positionAbsolute: { x: 0, y: 0 } } }],
    ]);
    expect(computeJunctors(groups, (id) => lookup.get(id))[0]).toMatchObject({
      cx: 110, // 220/2
      ty: 72, // 0 + 72
    });
  });

  it('emits one junctor per group, preserving kind', () => {
    const groups = [
      { id: 'a', kind: 'AND' as const, targetId: 't1' },
      { id: 'b', kind: 'XOR' as const, targetId: 't2' },
    ];
    const lookup = new Map<string, Geo>([
      ['t1', node(0, 0)],
      ['t2', node(500, 0)],
    ]);
    const out = computeJunctors(groups, (id) => lookup.get(id));
    expect(out.map((j) => `${j.kind}:${j.cx}`)).toEqual(['AND:110', 'XOR:610']);
  });
});
