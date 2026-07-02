import { beforeEach, describe, expect, it } from 'vitest';
import { ST_FACET_KEYS } from '@/domain/graph';
import type { AttrValue } from '@/domain/types';
import { validate } from '@/domain/validators';
import { makeDoc, makeEdge, makeEntity, resetIds } from '../helpers';

const RULE = 'st-tactic-assumptions';
const FILLED: AttrValue = { kind: 'string', value: 'because…' };

/** Build an S&T injection (tactic) with the listed facet attributes filled. */
const tactic = (title: string, facetKeys: string[] = []) =>
  makeEntity({
    type: 'injection',
    title,
    attributes: Object.fromEntries(facetKeys.map((k) => [k, FILLED])),
  });

const facetsFor = (warnings: ReturnType<typeof validate>, entityId: string) =>
  warnings.filter(
    (w) => w.ruleId === RULE && w.target.kind === 'entity' && w.target.id === entityId
  );

const allForRule = (warnings: ReturnType<typeof validate>) =>
  warnings.filter((w) => w.ruleId === RULE);

beforeEach(() => {
  resetIds();
});

describe('CLR: st-tactic-assumptions', () => {
  it('fires on an injection with zero facets filled (apex tactic)', () => {
    const t = tactic('Adopt new pricing tactic');
    const warnings = validate(makeDoc([t], [], 'st'));
    const hits = facetsFor(warnings, t.id);
    expect(hits.length).toBe(1);
    expect(hits[0]!.target).toEqual({ kind: 'entity', id: t.id });
    expect(hits[0]!.message).toBe(
      "Tactic missing 3 assumption facets (Necessary, Parallel, Sufficiency) — Goldratt's S&T prescribes a Necessary, Parallel, and Sufficiency assumption per tactic."
    );
  });

  it('reports the exact number + names of missing facets (1 present → 2 missing)', () => {
    const t = tactic('Tactic', [ST_FACET_KEYS.necessaryAssumption]);
    const hits = facetsFor(validate(makeDoc([t], [], 'st')), t.id);
    expect(hits.length).toBe(1);
    expect(hits[0]!.message).toContain(
      'Tactic missing 2 assumption facets (Parallel, Sufficiency)'
    );
  });

  it('uses singular "facet" when exactly one is missing (plural killer)', () => {
    const t = tactic('Tactic', [
      ST_FACET_KEYS.necessaryAssumption,
      ST_FACET_KEYS.parallelAssumption,
    ]);
    const hits = facetsFor(validate(makeDoc([t], [], 'st')), t.id);
    expect(hits.length).toBe(1);
    expect(hits[0]!.message).toContain('Tactic missing 1 assumption facet (Sufficiency)');
    expect(hits[0]!.message).not.toContain('1 assumption facets');
  });

  it('does NOT fire when all three facets are filled', () => {
    const t = tactic('Tactic', [
      ST_FACET_KEYS.necessaryAssumption,
      ST_FACET_KEYS.parallelAssumption,
      ST_FACET_KEYS.sufficiencyAssumption,
    ]);
    expect(facetsFor(validate(makeDoc([t], [], 'st')), t.id).length).toBe(0);
  });

  it('does NOT count necessaryCondition child entities (the fixed bug)', () => {
    // Three NC children feed the tactic, but zero facet attributes are filled —
    // the old edge-counting rule passed this; the facet-based rule flags 3.
    const t = tactic('Tactic');
    const na = makeEntity({ type: 'necessaryCondition', title: 'NA' });
    const pa = makeEntity({ type: 'necessaryCondition', title: 'PA' });
    const sa = makeEntity({ type: 'necessaryCondition', title: 'SA' });
    const edges = [makeEdge(na.id, t.id), makeEdge(pa.id, t.id), makeEdge(sa.id, t.id)];
    const hits = facetsFor(validate(makeDoc([t, na, pa, sa], edges, 'st')), t.id);
    expect(hits.length).toBe(1);
    expect(hits[0]!.message).toContain('missing 3 assumption facets');
  });

  it('only flags injection entities, not necessaryCondition or other types', () => {
    const t = tactic('Tactic');
    const nc = makeEntity({ type: 'necessaryCondition', title: 'A lone facet node' });
    const effect = makeEntity({ type: 'effect', title: 'An effect node' });
    const ruleHits = allForRule(validate(makeDoc([t, nc, effect], [], 'st')));
    expect(ruleHits.length).toBe(1);
    expect(ruleHits[0]!.target).toEqual({ kind: 'entity', id: t.id });
  });

  it('flags each under-specified injection independently', () => {
    const t1 = tactic('Tactic one'); // 0 facets → 3 missing
    const t2 = tactic('Tactic two', [ST_FACET_KEYS.necessaryAssumption]); // 1 facet → 2 missing
    const warnings = validate(makeDoc([t1, t2], [], 'st'));
    expect(allForRule(warnings).length).toBe(2);
    expect(facetsFor(warnings, t1.id)[0]!.message).toContain('missing 3 assumption facets');
    expect(facetsFor(warnings, t2.id)[0]!.message).toContain('missing 2 assumption facets');
  });

  it('does NOT fire on a non-st diagram even with an injection lacking facets', () => {
    const t = tactic('Tactic');
    expect(allForRule(validate(makeDoc([t], [], 'frt'))).length).toBe(0);
  });

  it('respects a user-resolved warning (resolved flag flows through)', () => {
    const t = tactic('Tactic');
    const warningId = `${RULE}:entity:${t.id}`;
    const hits = facetsFor(validate(makeDoc([t], [], 'st', { [warningId]: true })), t.id);
    expect(hits.length).toBe(1);
    expect(hits[0]!.resolved).toBe(true);
  });

  it('stamps the clarity tier on the warning', () => {
    const t = tactic('Tactic');
    const hits = facetsFor(validate(makeDoc([t], [], 'st')), t.id);
    expect(hits.length).toBe(1);
    expect(hits[0]!.tier).toBe('clarity');
  });
});
