import { beforeEach, describe, expect, it } from 'vitest';
import { INTERFERENCE_IMPACT_KEY } from '@/domain/interference';
import { buildInterferenceRankCsv } from '@/services/exporters/interferenceRank';
import { makeDoc, makeEdge, makeEntity, resetIds } from '../domain/helpers';

beforeEach(resetIds);

const impact = (value: number) => ({
  attributes: { [INTERFERENCE_IMPACT_KEY]: { kind: 'int' as const, value } },
});

const rows = (csv: string) => csv.split('\n').filter((l) => l.length > 0);

describe('buildInterferenceRankCsv', () => {
  it('emits just the header when the ID has no interferences', () => {
    const csv = buildInterferenceRankCsv(
      makeDoc([makeEntity({ type: 'goal', title: 'x' })], [], 'id')
    );
    expect(rows(csv)).toEqual(['rank,interference,minutes,pct_of_total,paired_io']);
  });

  it('ranks interferences by lost time with share and paired fix', () => {
    const io = makeEntity({ type: 'intermediateObjective', title: 'Kit the parts' });
    const a = makeEntity({ type: 'obstacle', title: 'Parts unavailable', ...impact(90) });
    const b = makeEntity({ type: 'obstacle', title: 'Breaks', ...impact(30) });
    const csv = buildInterferenceRankCsv(makeDoc([b, io, a], [makeEdge(io.id, a.id)], 'id'));
    const r = rows(csv);
    expect(r[0]).toBe('rank,interference,minutes,pct_of_total,paired_io');
    // Rank 1: the 90-minute interference, 75% of 120, paired IO title.
    expect(r[1]).toBe('1,Parts unavailable,90,75%,Kit the parts');
    // Rank 2: the 30-minute interference, 25%, no pairing.
    expect(r[2]).toBe('2,Breaks,30,25%,(none)');
  });

  it('leaves minutes blank (not 0) for an interference with no estimate', () => {
    const measured = makeEntity({ type: 'obstacle', title: 'Measured', ...impact(40) });
    const unmeasured = makeEntity({ type: 'obstacle', title: 'Unmeasured' });
    const csv = buildInterferenceRankCsv(makeDoc([measured, unmeasured], [], 'id'));
    const r = rows(csv);
    // Rank 1 is the measured interference (100% of the total).
    expect(r[1]).toBe('1,Measured,40,100%,(none)');
    // The unmeasured one sorts last with an empty minutes cell + 0%.
    expect(r[2]).toBe('2,Unmeasured,,0%,(none)');
  });
});
