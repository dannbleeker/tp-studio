import { beforeEach, describe, expect, it } from 'vitest';
import { INTERFERENCE_IMPACT_KEY } from '@/domain/interference';
import { rankInterferences, wholePercents } from '@/domain/interferenceRanking';
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

  it('returns [] for an ID with no interferences (only a central objective)', () => {
    const goal = makeEntity({ type: 'goal', title: 'More throughput' });
    expect(rankInterferences(makeDoc([goal], [], 'id'))).toEqual([]);
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

describe('wholePercents', () => {
  const idDocOf = (...values: number[]) =>
    makeDoc(
      values.map((v, i) => makeEntity({ type: 'obstacle', title: `I${i}`, ...impact(v) })),
      [],
      'id'
    );

  // Session 206 regression: rounding each share independently made the shipped
  // constraint-exploitation pattern's column read 35+24+18+12+12 = 101%.
  it('sums to exactly 100 for the shipped pattern impacts (was 101%)', () => {
    const pcts = wholePercents(rankInterferences(idDocOf(90, 60, 45, 30, 30)));
    expect(pcts.reduce((s, v) => s + v, 0)).toBe(100);
    // Exact shares are 35.29 / 23.53 / 17.65 / 11.76 / 11.76 → the floors sum to
    // 97, and the three spare points go to the largest fractions (.765, .765,
    // .647). Independent rounding produced [35, 24, 18, 12, 12] = 101%.
    expect(pcts).toEqual([35, 23, 18, 12, 12]);
  });

  it('sums to exactly 100 across assorted awkward splits', () => {
    for (const values of [
      [1, 1, 1],
      [2, 1],
      [1, 1, 1, 1, 1, 1],
      [7, 7, 7, 7, 7],
      [100, 1],
    ]) {
      const pcts = wholePercents(rankInterferences(idDocOf(...values)));
      expect(pcts.reduce((s, v) => s + v, 0)).toBe(100);
    }
  });

  it('gives the leftover point to the largest fractional share', () => {
    // Thirds: 33.33 each -> floors sum to 99; the spare point goes to the first
    // by rank order (all fractional parts tie).
    expect(wholePercents(rankInterferences(idDocOf(1, 1, 1)))).toEqual([34, 33, 33]);
  });

  it('is all-zero when nothing carries an impact (no total to apportion)', () => {
    const a = makeEntity({ type: 'obstacle', title: 'A' });
    const b = makeEntity({ type: 'obstacle', title: 'B' });
    expect(wholePercents(rankInterferences(makeDoc([a, b], [], 'id')))).toEqual([0, 0]);
  });

  it('returns [] for an empty ranking', () => {
    expect(wholePercents([])).toEqual([]);
  });
});
