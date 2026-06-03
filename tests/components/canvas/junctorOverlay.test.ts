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
  // Groups now carry their cause source ids so the circle can center over the
  // causes (Session 171). `grp` fills the sortable `sourceKey`. Empty sources →
  // the helper falls back to sitting under the target (first paint / unmeasured).
  const grp = (
    id: string,
    kind: 'AND' | 'OR' | 'XOR',
    targetId: string,
    sourceIds: string[] = []
  ) => ({ id, kind, targetId, sourceIds, sourceKey: [...sourceIds].sort().join(',') });

  it('falls back to under the target when no causes are measured — (x + w/2, bottom + offset)', () => {
    const groups = [grp('g1', 'AND', 't1')];
    const lookup = new Map<string, Geo>([['t1', node(100, 200)]]);
    expect(computeJunctors(groups, (id) => lookup.get(id))).toEqual([
      {
        id: 'g1',
        kind: 'AND',
        cx: 210, // 100 + 220/2 — no causes yet → fall back to the target's X
        tx: 210,
        ty: 272, // 200 + 72
        cy: 272 + JUNCTOR_CENTER_OFFSET_Y,
      },
    ]);
  });

  it('centers over its causes (nudged toward the target) when sources are offset', () => {
    // Two causes far to the left of the target: centers 10 and 110 (midpoint 60);
    // target center 210. Default nudge 0.25 → 60 + 0.25·(210−60) = 97.5. The
    // circle sits over the causes so they rise into it from below, while the line
    // up to the effect (`tx`/`ty`) still ends at the target → a clean diagonal.
    const groups = [grp('g1', 'AND', 't1', ['s1', 's2'])];
    const lookup = new Map<string, Geo>([
      ['t1', node(100, 200)], // center X 210
      ['s1', node(-100, 400)], // center X 10
      ['s2', node(0, 400)], // center X 110
    ]);
    const out = computeJunctors(groups, (id) => lookup.get(id));
    expect(out[0]?.cx).toBeCloseTo(97.5, 6);
    expect(out[0]?.tx).toBe(210); // line still terminates at the target
    expect(out[0]?.ty).toBe(272);
  });

  it('anchors to the bottom handle connection point when handle bounds exist', () => {
    // React Flow terminates the converging cause-edges at the bottom handle,
    // which sits below the measured box (the h-5 handle). The junctor must
    // follow that point — not the box bottom — or the cause-edges stop short of
    // the circle (the "AND/OR/XOR edges miss the circle" bug).
    const groups = [grp('g1', 'AND', 't1')];
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
    const groups = [grp('g1', 'AND', 't1')];
    const before = computeJunctors(groups, () => node(0, 0));
    const after = computeJunctors(groups, () => node(400, 300));
    expect(before[0]?.cx).toBe(110);
    expect(after[0]?.cx).toBe(510); // 400 + 110 — circle followed the move
    expect(after[0]?.ty).toBe(372); // 300 + 72
  });

  it('skips a group whose target is not (yet) in the lookup', () => {
    const groups = [grp('g1', 'OR', 'missing')];
    expect(computeJunctors(groups, () => undefined)).toEqual([]);
  });

  it('falls back to the default node size when measured is absent', () => {
    const groups = [grp('g1', 'XOR', 't1')];
    const lookup = new Map<string, Geo>([
      ['t1', { internals: { positionAbsolute: { x: 0, y: 0 } } }],
    ]);
    expect(computeJunctors(groups, (id) => lookup.get(id))[0]).toMatchObject({
      cx: 110, // 220/2
      ty: 72, // 0 + 72
    });
  });

  it('emits one junctor per group, preserving kind', () => {
    const groups = [grp('a', 'AND', 't1'), grp('b', 'XOR', 't2')];
    const lookup = new Map<string, Geo>([
      ['t1', node(0, 0)],
      ['t2', node(500, 0)],
    ]);
    const out = computeJunctors(groups, (id) => lookup.get(id));
    expect(out.map((j) => `${j.kind}:${j.cx}`)).toEqual(['AND:110', 'XOR:610']);
  });
});
