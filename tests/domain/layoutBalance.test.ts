/**
 * Goal #4 — post-dagre centering pass (`balanceFreeAxis` in `layout.ts`).
 *
 * dagre balances a mid-tree effect between its parent (above) and its
 * causes (below), tugging it sideways off its causes — so the locked
 * shortest-side edge anchoring draws a long diagonal into the effect's
 * side. The centering pass re-centers each node over the mean position of
 * its causes. These tests pin the contract (effect centered over its
 * causes) plus the invariants the pass must never break: no overlap, no
 * reordering, determinism. All boxes share a width so a top-left x compares
 * directly to a centre x.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { clearLayoutCacheForTests, computeLayout } from '@/domain/layout';

const box = (id: string) => ({ id, width: 200, height: 80 });
const NODE_W = 200;

beforeEach(clearLayoutCacheForTests);

describe('computeLayout — balance / centering (goal #4)', () => {
  it('centers a mid-tree effect over its causes despite a parent pulling it sideways', () => {
    // C1,C2 → E → P, and C3 → P. As P's child, E is tugged toward P (which
    // also sits over C3) during dagre's balance; the centering pass pulls E
    // back over the mean of C1/C2.
    const result = computeLayout(
      [box('C1'), box('C2'), box('C3'), box('E'), box('P')],
      [
        { sourceId: 'C1', targetId: 'E' },
        { sourceId: 'C2', targetId: 'E' },
        { sourceId: 'E', targetId: 'P' },
        { sourceId: 'C3', targetId: 'P' },
      ]
    );
    const meanCauses = (result.C1!.x + result.C2!.x) / 2;
    expect(Math.abs(result.E!.x - meanCauses)).toBeLessThanOrEqual(8);
    // E and its rank-sibling C3 must stay overlap-free (the clamp held).
    expect(Math.abs(result.E!.x - result.C3!.x)).toBeGreaterThanOrEqual(NODE_W);
  });

  it('keeps a multi-cause fan overlap-free and the effect within the span', () => {
    const result = computeLayout(
      [box('C1'), box('C2'), box('C3'), box('E')],
      [
        { sourceId: 'C1', targetId: 'E' },
        { sourceId: 'C2', targetId: 'E' },
        { sourceId: 'C3', targetId: 'E' },
      ]
    );
    const xs = [result.C1!.x, result.C2!.x, result.C3!.x].sort((a, b) => a - b);
    expect(xs[1]! - xs[0]!).toBeGreaterThanOrEqual(NODE_W);
    expect(xs[2]! - xs[1]!).toBeGreaterThanOrEqual(NODE_W);
    // The effect sits within its causes' horizontal span (centered, not flung out).
    expect(result.E!.x).toBeGreaterThanOrEqual(xs[0]! - 1);
    expect(result.E!.x).toBeLessThanOrEqual(xs[2]! + 1);
  });

  it('is deterministic across repeated (un-cached) layouts', () => {
    const nodes = [box('C1'), box('C2'), box('C3'), box('E'), box('P')];
    const edges = [
      { sourceId: 'C1', targetId: 'E' },
      { sourceId: 'C2', targetId: 'E' },
      { sourceId: 'E', targetId: 'P' },
      { sourceId: 'C3', targetId: 'P' },
    ];
    const a = computeLayout(nodes, edges);
    clearLayoutCacheForTests();
    const b = computeLayout(nodes, edges);
    expect(a).toEqual(b);
  });

  it('leaves a single cause→effect chain aligned (no-op for ≤2 nodes)', () => {
    const result = computeLayout([box('a'), box('b')], [{ sourceId: 'a', targetId: 'b' }]);
    expect(Math.abs(result.a!.x - result.b!.x)).toBeLessThanOrEqual(8);
  });

  it('keeps a multi-parent node overlap-free', () => {
    // X feeds both E1 and E2; E1 also has cause C. The two effects share a
    // rank and are pulled toward overlapping centres — the clamp keeps them
    // apart without reordering.
    const result = computeLayout(
      [box('X'), box('C'), box('E1'), box('E2')],
      [
        { sourceId: 'X', targetId: 'E1' },
        { sourceId: 'C', targetId: 'E1' },
        { sourceId: 'X', targetId: 'E2' },
      ]
    );
    expect(Math.abs(result.E1!.x - result.E2!.x)).toBeGreaterThanOrEqual(NODE_W);
  });
});
