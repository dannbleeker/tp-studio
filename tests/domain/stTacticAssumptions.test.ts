import { stTacticAssumptionsRule } from '@/domain/validators/stTacticAssumptions';
import { describe, expect, it } from 'vitest';
import { makeDoc, makeEdge, makeEntity, resetIds } from './helpers';

const buildSTDoc = (
  entities: ReturnType<typeof makeEntity>[],
  edges: ReturnType<typeof makeEdge>[]
) => {
  resetIds();
  const doc = makeDoc(entities, edges, 'st');
  return doc;
};

/**
 * Session 76 / FL-DT4 follow-up — every tactic (injection) in an S&T
 * diagram should declare three assumption facets (NA, PA, SA), modeled
 * as three incoming `necessaryCondition` entities. Rule fires when an
 * injection has fewer than three.
 */

describe('st-tactic-assumptions rule', () => {
  it('does not fire on non-S&T diagrams', () => {
    resetIds();
    const tactic = makeEntity({ type: 'injection', title: 'Tactic with no NCs' });
    const ude = makeEntity({ type: 'ude' });
    const doc = makeDoc([tactic, ude], [makeEdge(tactic.id, ude.id)], 'crt');
    expect(stTacticAssumptionsRule(doc)).toHaveLength(0);
  });

  it('fires on an injection with zero necessaryCondition feeders', () => {
    const tactic = makeEntity({ type: 'injection', title: 'Tactic' });
    const apex = makeEntity({ type: 'goal' });
    const doc = buildSTDoc([apex, tactic], [makeEdge(tactic.id, apex.id)]);
    const warnings = stTacticAssumptionsRule(doc);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.target.kind).toBe('entity');
    expect(warnings[0]?.target.kind === 'entity' && warnings[0]?.target.id).toBe(tactic.id);
    expect(warnings[0]?.message).toMatch(/3 assumption facets/);
  });

  it('fires with the correct count when the tactic has 1 or 2 facets', () => {
    const tactic = makeEntity({ type: 'injection', title: 'Tactic' });
    const na = makeEntity({ type: 'necessaryCondition', title: 'NA: foo' });
    const pa = makeEntity({ type: 'necessaryCondition', title: 'PA: bar' });
    const apex = makeEntity({ type: 'goal' });
    const doc = buildSTDoc(
      [apex, tactic, na, pa],
      [makeEdge(tactic.id, apex.id), makeEdge(na.id, tactic.id), makeEdge(pa.id, tactic.id)]
    );
    const warnings = stTacticAssumptionsRule(doc);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.message).toMatch(/1 assumption facet —/);
  });

  it('does not fire on a tactic with all three facets', () => {
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
    expect(stTacticAssumptionsRule(doc)).toHaveLength(0);
  });

  it('only counts necessaryCondition feeders (other types like assumption do not satisfy)', () => {
    const tactic = makeEntity({ type: 'injection', title: 'Tactic' });
    const a1 = makeEntity({ type: 'assumption', title: 'A1' });
    const a2 = makeEntity({ type: 'assumption', title: 'A2' });
    const a3 = makeEntity({ type: 'assumption', title: 'A3' });
    const apex = makeEntity({ type: 'goal' });
    const doc = buildSTDoc(
      [apex, tactic, a1, a2, a3],
      [
        makeEdge(tactic.id, apex.id),
        makeEdge(a1.id, tactic.id),
        makeEdge(a2.id, tactic.id),
        makeEdge(a3.id, tactic.id),
      ]
    );
    // `assumption` entities are typically edge-attachments, not full
    // graph nodes; the rule requires structural `necessaryCondition`
    // entities (the canonical NA/PA/SA carriers in TP Studio's S&T
    // model).
    expect(stTacticAssumptionsRule(doc)).toHaveLength(1);
  });
});
