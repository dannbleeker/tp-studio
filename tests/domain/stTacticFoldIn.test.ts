import { describe, expect, it } from 'vitest';
import { validate } from '@/domain/validators';
import { stTacticFoldInRule } from '@/domain/validators/stTacticFoldIn';
import { makeDoc, makeEdge, makeEntity, resetIds } from './helpers';

/**
 * Session 198 (backlog B) — the S&T "fold-in" rule. A step that decomposes into
 * exactly ONE sub-step should split into ≥2 jointly-sufficient sub-steps or fold
 * the single child back in. Edge convention: child → parent, so a step's INCOMING
 * edges come from its children.
 */

const RULE = 'st-tactic-fold-in';

/** A parent injection with `childCount` injection children feeding it. */
const buildWithChildren = (childCount: number) => {
  resetIds();
  const parent = makeEntity({ type: 'injection', title: 'Parent step' });
  const children = Array.from({ length: childCount }, (_, i) =>
    makeEntity({ type: 'injection', title: `Child ${i + 1}` })
  );
  const edges = children.map((c) => makeEdge(c.id, parent.id));
  return { parent, doc: makeDoc([parent, ...children], edges, 'st') };
};

describe('st-tactic-fold-in rule', () => {
  it('fires on a step with exactly one sub-step', () => {
    const { parent, doc } = buildWithChildren(1);
    const hits = stTacticFoldInRule(doc).filter(
      (w) => w.target.kind === 'entity' && w.target.id === parent.id
    );
    expect(hits.length).toBe(1);
    expect(hits[0]?.message).toContain('only one sub-step');
  });

  it('does not fire on a leaf (zero children) — that is st-tactic-rollup territory', () => {
    const { parent, doc } = buildWithChildren(0);
    expect(
      stTacticFoldInRule(doc).filter((w) => w.target.kind === 'entity' && w.target.id === parent.id)
    ).toHaveLength(0);
  });

  it('does not fire on a proper decomposition (two or more children)', () => {
    const { parent, doc } = buildWithChildren(2);
    expect(
      stTacticFoldInRule(doc).filter((w) => w.target.kind === 'entity' && w.target.id === parent.id)
    ).toHaveLength(0);
  });

  it('does not fire when the only child is a legacy sub-strategy (goal), not a tactic (bug-hunt #12)', () => {
    // Legacy S&T model: goal = sub-strategy, injection = tactic. A tactic whose
    // single incoming edge comes from a sub-strategy goal (not another tactic)
    // must not read as a lone sub-step — that's a false positive on curated
    // first-party patterns (st-quality-first et al.).
    resetIds();
    const parent = makeEntity({ type: 'injection', title: 'Tactic' });
    const subStrategy = makeEntity({ type: 'goal', title: 'Sub-strategy goal' });
    const doc = makeDoc([parent, subStrategy], [makeEdge(subStrategy.id, parent.id)], 'st');
    expect(
      stTacticFoldInRule(doc).filter((w) => w.target.kind === 'entity' && w.target.id === parent.id)
    ).toHaveLength(0);
  });

  it('skips an unspecified placeholder', () => {
    resetIds();
    const parent = makeEntity({ type: 'injection', title: 'Placeholder', unspecified: true });
    const child = makeEntity({ type: 'injection', title: 'Only child' });
    const doc = makeDoc([parent, child], [makeEdge(child.id, parent.id)], 'st');
    expect(
      stTacticFoldInRule(doc).filter((w) => w.target.kind === 'entity' && w.target.id === parent.id)
    ).toHaveLength(0);
  });

  it('registers on st diagrams via validate() at tier sufficiency; not on crt', () => {
    const { parent, doc } = buildWithChildren(1);
    const hit = validate(doc).find(
      (w) => w.ruleId === RULE && w.target.kind === 'entity' && w.target.id === parent.id
    );
    expect(hit).toBeDefined();
    expect(hit?.tier).toBe('sufficiency');

    resetIds();
    const p = makeEntity({ type: 'injection', title: 'P' });
    const c = makeEntity({ type: 'injection', title: 'C' });
    const crt = makeDoc([p, c], [makeEdge(c.id, p.id)], 'crt');
    expect(validate(crt).some((w) => w.ruleId === RULE)).toBe(false);
  });
});
