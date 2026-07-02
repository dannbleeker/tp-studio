import { describe, expect, it } from 'vitest';
import { ST_FACET_KEYS } from '@/domain/graph';
import type { AttrValue } from '@/domain/types';
import { stTacticAssumptionsRule } from '@/domain/validators/stTacticAssumptions';
import { makeDoc, makeEdge, makeEntity, resetIds } from './helpers';

/**
 * Session 76 / FL-DT4 — every tactic (injection) in an S&T diagram should
 * declare three assumption facets (NA, PA, SA), stored as the reserved
 * `st*Assumption` entity attributes (the 5-facet card). The rule fires on
 * injections with any facet still empty and names which are missing.
 */

const filled: AttrValue = { kind: 'string', value: 'because…' };

/** An S&T injection (tactic) with the given facet attributes pre-filled. */
const tacticWith = (facetKeys: string[]) =>
  makeEntity({
    type: 'injection',
    title: 'Tactic',
    attributes: Object.fromEntries(facetKeys.map((k) => [k, filled])),
  });

const buildSTDoc = (
  entities: ReturnType<typeof makeEntity>[],
  edges: ReturnType<typeof makeEdge>[]
) => {
  resetIds();
  return makeDoc(entities, edges, 'st');
};

describe('st-tactic-assumptions rule', () => {
  it('does not fire on non-S&T diagrams', () => {
    resetIds();
    const tactic = makeEntity({ type: 'injection', title: 'Tactic with no facets' });
    const ude = makeEntity({ type: 'ude' });
    const doc = makeDoc([tactic, ude], [makeEdge(tactic.id, ude.id)], 'crt');
    expect(stTacticAssumptionsRule(doc)).toHaveLength(0);
  });

  it('fires on an injection with zero facets filled (missing all three)', () => {
    resetIds();
    const tactic = makeEntity({ type: 'injection', title: 'Tactic' });
    const apex = makeEntity({ type: 'goal' });
    const doc = buildSTDoc([apex, tactic], [makeEdge(tactic.id, apex.id)]);
    const warnings = stTacticAssumptionsRule(doc);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.target).toEqual({ kind: 'entity', id: tactic.id });
    expect(warnings[0]?.message).toMatch(
      /3 assumption facets \(Necessary, Parallel, Sufficiency\)/
    );
  });

  it('names the specific missing facet when the tactic has two of three', () => {
    resetIds();
    const tactic = tacticWith([
      ST_FACET_KEYS.necessaryAssumption,
      ST_FACET_KEYS.parallelAssumption,
    ]);
    const apex = makeEntity({ type: 'goal' });
    const doc = buildSTDoc([apex, tactic], [makeEdge(tactic.id, apex.id)]);
    const warnings = stTacticAssumptionsRule(doc);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.message).toMatch(/1 assumption facet \(Sufficiency\)/);
  });

  it('does not fire when all three facets are filled', () => {
    resetIds();
    const tactic = tacticWith([
      ST_FACET_KEYS.necessaryAssumption,
      ST_FACET_KEYS.parallelAssumption,
      ST_FACET_KEYS.sufficiencyAssumption,
    ]);
    const apex = makeEntity({ type: 'goal' });
    const doc = buildSTDoc([apex, tactic], [makeEdge(tactic.id, apex.id)]);
    expect(stTacticAssumptionsRule(doc)).toHaveLength(0);
  });

  it('treats a whitespace-only facet as empty', () => {
    resetIds();
    const tactic = makeEntity({
      type: 'injection',
      title: 'Tactic',
      attributes: {
        [ST_FACET_KEYS.necessaryAssumption]: { kind: 'string', value: '   ' },
        [ST_FACET_KEYS.parallelAssumption]: filled,
        [ST_FACET_KEYS.sufficiencyAssumption]: filled,
      },
    });
    const apex = makeEntity({ type: 'goal' });
    const doc = buildSTDoc([apex, tactic], [makeEdge(tactic.id, apex.id)]);
    expect(stTacticAssumptionsRule(doc)[0]?.message).toMatch(/1 assumption facet \(Necessary\)/);
  });

  it('does NOT count necessaryCondition child entities toward the facets (the fixed bug)', () => {
    resetIds();
    // Three NC children feeding the tactic, but zero facet attributes filled.
    // The old rule counted these and passed; the facet-based rule flags all three.
    const tactic = makeEntity({ type: 'injection', title: 'Tactic' });
    const na = makeEntity({ type: 'necessaryCondition', title: 'NA' });
    const pa = makeEntity({ type: 'necessaryCondition', title: 'PA' });
    const sa = makeEntity({ type: 'necessaryCondition', title: 'SA' });
    const apex = makeEntity({ type: 'goal' });
    const doc = buildSTDoc(
      [apex, tactic, na, pa, sa],
      [
        makeEdge(tactic.id, apex.id),
        makeEdge(na.id, tactic.id),
        makeEdge(pa.id, tactic.id),
        makeEdge(sa.id, tactic.id),
      ]
    );
    const warnings = stTacticAssumptionsRule(doc);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.message).toMatch(/3 assumption facets/);
  });
});
