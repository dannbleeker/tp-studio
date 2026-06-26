import { beforeEach, describe, expect, it } from 'vitest';
import { validate } from '@/domain/validators';
import { makeDoc, makeEdge, makeEntity, resetIds } from '../helpers';

const RULE = 'st-tactic-assumptions';

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
  it('fires on an injection with zero assumption facets (apex tactic)', () => {
    const tactic = makeEntity({ type: 'injection', title: 'Adopt new pricing tactic' });
    const warnings = validate(makeDoc([tactic], [], 'st'));
    const hits = facetsFor(warnings, tactic.id);
    expect(hits.length).toBe(1);
    expect(hits[0]!.target).toEqual({ kind: 'entity', id: tactic.id });
    expect(hits[0]!.message).toBe(
      "Tactic missing 3 assumption facets — Goldratt's S&T prescribes a Necessary, Parallel, and Sufficiency assumption per tactic."
    );
  });

  it('reports the exact number of missing facets (2 missing → 1 present)', () => {
    const tactic = makeEntity({ type: 'injection', title: 'Tactic' });
    const na = makeEntity({ type: 'necessaryCondition', title: 'NA: parent strategy matters' });
    const edge = makeEdge(na.id, tactic.id);
    const warnings = validate(makeDoc([tactic, na], [edge], 'st'));
    const hits = facetsFor(warnings, tactic.id);
    expect(hits.length).toBe(1);
    expect(hits[0]!.message).toContain('Tactic missing 2 assumption facets');
  });

  it('uses singular "facet" when exactly one facet is missing (off-by-one / plural killer)', () => {
    const tactic = makeEntity({ type: 'injection', title: 'Tactic' });
    const na = makeEntity({ type: 'necessaryCondition', title: 'NA' });
    const pa = makeEntity({ type: 'necessaryCondition', title: 'PA' });
    const edges = [makeEdge(na.id, tactic.id), makeEdge(pa.id, tactic.id)];
    const warnings = validate(makeDoc([tactic, na, pa], edges, 'st'));
    const hits = facetsFor(warnings, tactic.id);
    expect(hits.length).toBe(1);
    // singular "facet", not "facets"
    expect(hits[0]!.message).toContain('Tactic missing 1 assumption facet —');
    expect(hits[0]!.message).not.toContain('1 assumption facets');
  });

  it('does NOT fire when exactly three necessaryCondition facets feed the tactic (boundary)', () => {
    const tactic = makeEntity({ type: 'injection', title: 'Tactic' });
    const na = makeEntity({ type: 'necessaryCondition', title: 'NA' });
    const pa = makeEntity({ type: 'necessaryCondition', title: 'PA' });
    const sa = makeEntity({ type: 'necessaryCondition', title: 'SA' });
    const edges = [
      makeEdge(na.id, tactic.id),
      makeEdge(pa.id, tactic.id),
      makeEdge(sa.id, tactic.id),
    ];
    const warnings = validate(makeDoc([tactic, na, pa, sa], edges, 'st'));
    expect(facetsFor(warnings, tactic.id).length).toBe(0);
  });

  it('does NOT fire with four or more facets (above threshold)', () => {
    const tactic = makeEntity({ type: 'injection', title: 'Tactic' });
    const facets = Array.from({ length: 4 }, (_, i) =>
      makeEntity({ type: 'necessaryCondition', title: `facet ${i}` })
    );
    const edges = facets.map((f) => makeEdge(f.id, tactic.id));
    const warnings = validate(makeDoc([tactic, ...facets], edges, 'st'));
    expect(facetsFor(warnings, tactic.id).length).toBe(0);
  });

  it('counts only necessaryCondition sources — other incoming source types do not count', () => {
    const tactic = makeEntity({ type: 'injection', title: 'Tactic' });
    const na = makeEntity({ type: 'necessaryCondition', title: 'NA' });
    // Two non-necessaryCondition incoming sources that must NOT be counted as facets.
    const strategy = makeEntity({ type: 'injection', title: 'Parent injection' });
    const generic = makeEntity({ type: 'effect', title: 'Some effect' });
    const edges = [
      makeEdge(na.id, tactic.id),
      makeEdge(strategy.id, tactic.id),
      makeEdge(generic.id, tactic.id),
    ];
    const warnings = validate(makeDoc([tactic, na, strategy, generic], edges, 'st'));
    const hits = facetsFor(warnings, tactic.id);
    expect(hits.length).toBe(1);
    // Only the single necessaryCondition counts → 2 missing, not 0.
    expect(hits[0]!.message).toContain('Tactic missing 2 assumption facets');
  });

  it('counts direction correctly: outgoing necessaryCondition edges do NOT count', () => {
    const tactic = makeEntity({ type: 'injection', title: 'Tactic' });
    const nc = makeEntity({ type: 'necessaryCondition', title: 'NC' });
    // Edge points FROM the tactic TO the necessaryCondition — i.e. the
    // necessaryCondition is a target, not a source feeding the tactic.
    const edge = makeEdge(tactic.id, nc.id);
    const warnings = validate(makeDoc([tactic, nc], [edge], 'st'));
    const hits = facetsFor(warnings, tactic.id);
    expect(hits.length).toBe(1);
    // No incoming facet → still 3 missing.
    expect(hits[0]!.message).toContain('Tactic missing 3 assumption facets');
  });

  it('only flags injection entities, not necessaryCondition or other types', () => {
    const tactic = makeEntity({ type: 'injection', title: 'Tactic' });
    const nc = makeEntity({ type: 'necessaryCondition', title: 'A lone facet node' });
    const effect = makeEntity({ type: 'effect', title: 'An effect node' });
    const warnings = validate(makeDoc([tactic, nc, effect], [], 'st'));
    // Only the injection is targeted by this rule.
    const ruleHits = allForRule(warnings);
    expect(ruleHits.length).toBe(1);
    expect(ruleHits[0]!.target).toEqual({ kind: 'entity', id: tactic.id });
  });

  it('flags each under-specified injection independently', () => {
    const t1 = makeEntity({ type: 'injection', title: 'Tactic one' });
    const t2 = makeEntity({ type: 'injection', title: 'Tactic two' });
    const na = makeEntity({ type: 'necessaryCondition', title: 'NA for t2' });
    // t2 has one facet (2 missing); t1 has none (3 missing).
    const edge = makeEdge(na.id, t2.id);
    const warnings = validate(makeDoc([t1, t2, na], [edge], 'st'));
    expect(allForRule(warnings).length).toBe(2);
    expect(facetsFor(warnings, t1.id)[0]!.message).toContain('missing 3 assumption facets');
    expect(facetsFor(warnings, t2.id)[0]!.message).toContain('missing 2 assumption facets');
  });

  it('does NOT fire on a non-st diagram even with an injection lacking facets', () => {
    const tactic = makeEntity({ type: 'injection', title: 'Tactic' });
    // frt also registers the injection type but not this rule.
    const warnings = validate(makeDoc([tactic], [], 'frt'));
    expect(allForRule(warnings).length).toBe(0);
  });

  it('respects a user-resolved warning (resolved flag flows through)', () => {
    const tactic = makeEntity({ type: 'injection', title: 'Tactic' });
    const warningId = `${RULE}:entity:${tactic.id}`;
    const warnings = validate(makeDoc([tactic], [], 'st', { [warningId]: true }));
    const hits = facetsFor(warnings, tactic.id);
    expect(hits.length).toBe(1);
    expect(hits[0]!.resolved).toBe(true);
  });

  it('stamps the clarity tier on the warning', () => {
    const tactic = makeEntity({ type: 'injection', title: 'Tactic' });
    const warnings = validate(makeDoc([tactic], [], 'st'));
    const hits = facetsFor(warnings, tactic.id);
    expect(hits.length).toBe(1);
    expect(hits[0]!.tier).toBe('clarity');
  });
});
