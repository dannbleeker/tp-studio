import { ecMissingConflictRule, validate } from '@/domain/validators';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeDoc, makeEdge, makeEntity, resetIds } from './helpers';

beforeEach(() => {
  resetIds();
});

const hasRule = (warnings: ReturnType<typeof validate>, id: string) =>
  warnings.some((w) => w.ruleId === id);

describe('CLR: EC missing-conflict rule', () => {
  it('fires when an EC has two Wants but no mutex edge between them', () => {
    const a = makeEntity({ type: 'want', title: 'Leave at 5' });
    const b = makeEntity({ type: 'want', title: 'Stay late' });
    const doc = makeDoc([a, b], [], 'ec');
    const out = ecMissingConflictRule(doc);
    expect(out.length).toBe(1);
    expect(out[0]?.target).toEqual({ kind: 'entity', id: a.id });
  });

  it('does not fire when one Want is present alone', () => {
    const a = makeEntity({ type: 'want', title: 'Leave at 5' });
    const doc = makeDoc([a], [], 'ec');
    expect(ecMissingConflictRule(doc)).toEqual([]);
  });

  it('stops firing once any want↔want edge is tagged isMutualExclusion', () => {
    const a = makeEntity({ type: 'want', title: 'Leave at 5' });
    const b = makeEntity({ type: 'want', title: 'Stay late' });
    const edge = makeEdge(a.id, b.id, { isMutualExclusion: true });
    const doc = makeDoc([a, b], [edge], 'ec');
    expect(ecMissingConflictRule(doc)).toEqual([]);
  });

  it('does not fire when the want↔want edge exists but lacks the isMutualExclusion flag', () => {
    const a = makeEntity({ type: 'want', title: 'A' });
    const b = makeEntity({ type: 'want', title: 'B' });
    const edge = makeEdge(a.id, b.id);
    const doc = makeDoc([a, b], [edge], 'ec');
    expect(ecMissingConflictRule(doc).length).toBe(1);
  });

  it('registers on EC diagrams via the validate() pipeline; CRT stays silent', () => {
    const a = makeEntity({ type: 'want', title: 'A' });
    const b = makeEntity({ type: 'want', title: 'B' });
    const ec = makeDoc([a, b], [], 'ec');
    expect(hasRule(validate(ec), 'ec-missing-conflict')).toBe(true);
    const crt = makeDoc([a, b], [], 'crt');
    expect(hasRule(validate(crt), 'ec-missing-conflict')).toBe(false);
  });
});
