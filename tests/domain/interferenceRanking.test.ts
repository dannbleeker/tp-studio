import { beforeEach, describe, expect, it } from 'vitest';
import { INTERFERENCE_IMPACT_KEY } from '@/domain/interference';
import { rankInterferences } from '@/domain/interferenceRanking';
import { makeDoc, makeEdge, makeEntity, resetIds } from './helpers';

beforeEach(resetIds);

const impact = (value: number) => ({
  attributes: { [INTERFERENCE_IMPACT_KEY]: { kind: 'int' as const, value } },
});

describe('rankInterferences', () => {
  it('returns [] on a non-ID diagram', () => {
    const o = makeEntity({ type: 'obstacle', title: 'x' });
    expect(rankInterferences(makeDoc([o], [], 'prt'))).toEqual([]);
  });

  it('ranks interferences by impact descending, computing share of total', () => {
    const a = makeEntity({ type: 'obstacle', title: 'Parts unavailable', ...impact(90) });
    const b = makeEntity({ type: 'obstacle', title: 'Breaks', ...impact(60) });
    const c = makeEntity({ type: 'obstacle', title: 'Broken machine', ...impact(30) });
    const items = rankInterferences(makeDoc([b, c, a], [], 'id'));
    expect(items.map((i) => i.entity.title)).toEqual([
      'Parts unavailable',
      'Breaks',
      'Broken machine',
    ]);
    expect(items.map((i) => i.minutes)).toEqual([90, 60, 30]);
    // 90 / 180 = 50%.
    expect(items[0]!.pctOfTotal).toBeCloseTo(0.5, 5);
  });

  it('sorts interferences with no impact estimate to the bottom (0 minutes)', () => {
    const withImpact = makeEntity({ type: 'obstacle', title: 'Measured', ...impact(45) });
    const noImpact = makeEntity({ type: 'obstacle', title: 'Unmeasured' });
    const items = rankInterferences(makeDoc([noImpact, withImpact], [], 'id'));
    expect(items.map((i) => i.entity.title)).toEqual(['Measured', 'Unmeasured']);
    expect(items[1]!.minutes).toBe(0);
    expect(items[1]!.pctOfTotal).toBe(0);
  });

  it('resolves the paired intermediate objective from an IO → interference edge', () => {
    const io = makeEntity({ type: 'intermediateObjective', title: 'Kit the parts' });
    const interference = makeEntity({
      type: 'obstacle',
      title: 'Parts unavailable',
      ...impact(90),
    });
    const items = rankInterferences(
      makeDoc([io, interference], [makeEdge(io.id, interference.id)], 'id')
    );
    expect(items[0]!.pairedIoId).toBe(io.id);
  });

  it('leaves pairedIoId undefined for an unpaired interference', () => {
    const interference = makeEntity({ type: 'obstacle', title: 'Lonely', ...impact(10) });
    const items = rankInterferences(makeDoc([interference], [], 'id'));
    expect(items[0]!.pairedIoId).toBeUndefined();
  });

  it('gives every interference 0% when none carry an impact (avoids divide-by-zero)', () => {
    const a = makeEntity({ type: 'obstacle', title: 'a' });
    const b = makeEntity({ type: 'obstacle', title: 'b' });
    const items = rankInterferences(makeDoc([a, b], [], 'id'));
    expect(items.every((i) => i.pctOfTotal === 0)).toBe(true);
  });
});
