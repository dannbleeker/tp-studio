import { describe, expect, it } from 'vitest';
import {
  LAYOUT_RANK_SEPARATION_FAN_STEP,
  LAYOUT_RANK_SEPARATION_MAX_BONUS,
} from '@/domain/constants';
import { computeLayout, fanoutRankBonus } from '@/domain/layout';

const box = (id: string) => ({ id, width: 200, height: 80 });

describe('computeLayout', () => {
  it('returns an empty result for an empty graph', () => {
    expect(computeLayout([], [])).toEqual({});
  });

  it('positions a single node deterministically', () => {
    const result = computeLayout([box('a')], []);
    expect(result.a).toBeDefined();
    expect(typeof result.a!.x).toBe('number');
    expect(typeof result.a!.y).toBe('number');
  });

  it('lays out cause below effect with default BT direction', () => {
    const result = computeLayout(
      [box('cause'), box('effect')],
      [{ sourceId: 'cause', targetId: 'effect' }]
    );
    // BT: bottom-to-top → cause (source) sits lower (greater y) than effect (target).
    expect(result.cause!.y).toBeGreaterThan(result.effect!.y);
  });

  it('respects an alternate direction', () => {
    const result = computeLayout([box('a'), box('b')], [{ sourceId: 'a', targetId: 'b' }], {
      direction: 'LR',
    });
    // LR: source on the left → a.x < b.x
    expect(result.a!.x).toBeLessThan(result.b!.x);
  });

  it('ignores edges that reference unknown nodes', () => {
    const result = computeLayout([box('a')], [{ sourceId: 'a', targetId: 'ghost' }]);
    expect(Object.keys(result)).toEqual(['a']);
  });
});

describe('fanoutRankBonus (Session 146 — adaptive rank spacing)', () => {
  // k causes converging on one effect (effect in-degree = k).
  const fanIn = (k: number) => ({
    nodes: [box('e'), ...Array.from({ length: k }, (_, i) => box(`c${i}`))],
    edges: Array.from({ length: k }, (_, i) => ({ sourceId: `c${i}`, targetId: 'e' })),
  });

  it('is 0 at or below the threshold — binary / linear trees are unchanged', () => {
    expect(fanoutRankBonus(fanIn(1).nodes, fanIn(1).edges)).toBe(0);
    expect(fanoutRankBonus(fanIn(2).nodes, fanIn(2).edges)).toBe(0);
  });

  it('scales by FAN_STEP per branch beyond the threshold', () => {
    expect(fanoutRankBonus(fanIn(3).nodes, fanIn(3).edges)).toBe(LAYOUT_RANK_SEPARATION_FAN_STEP);
    expect(fanoutRankBonus(fanIn(5).nodes, fanIn(5).edges)).toBe(
      3 * LAYOUT_RANK_SEPARATION_FAN_STEP
    );
  });

  it('is hard-capped so a huge fan cannot run wild', () => {
    expect(fanoutRankBonus(fanIn(50).nodes, fanIn(50).edges)).toBe(
      LAYOUT_RANK_SEPARATION_MAX_BONUS
    );
  });

  it('counts out-degree (divergence) too, and ignores dangling edges', () => {
    // one cause branching to 4 effects (out-degree 4) → (4 − 2) × step.
    const nodes = [box('c'), box('e0'), box('e1'), box('e2'), box('e3')];
    const edges = [0, 1, 2, 3].map((i) => ({ sourceId: 'c', targetId: `e${i}` }));
    expect(fanoutRankBonus(nodes, edges)).toBe(2 * LAYOUT_RANK_SEPARATION_FAN_STEP);
    // an edge to a node not in the set doesn't inflate the fan count.
    expect(fanoutRankBonus([box('c')], [{ sourceId: 'c', targetId: 'ghost' }])).toBe(0);
  });

  it('pushes the effect further from its causes for a wide fan than a narrow one', () => {
    const layout = (k: number) =>
      computeLayout(
        [box('e'), ...Array.from({ length: k }, (_, i) => box(`c${i}`))],
        Array.from({ length: k }, (_, i) => ({ sourceId: `c${i}`, targetId: 'e' }))
      );
    // BT: causes sit below the effect (greater y). Gap = cause.y − effect.y.
    const narrow = layout(2); // no bonus
    const wide = layout(5); // +bonus ranksep
    expect(wide.c0!.y - wide.e!.y).toBeGreaterThan(narrow.c0!.y - narrow.e!.y);
  });
});
