import { describe, expect, it } from 'vitest';
import { validate } from '@/domain/validators';
import { stTacticRollupRule } from '@/domain/validators/stTacticRollup';
import { makeDoc, makeEdge, makeEntity, resetIds } from './helpers';

/**
 * Session 135 — `st-tactic-rollup` rule tests. Fires on non-apex
 * `injection` (tactic) entities that lack child tactics feeding
 * them via incoming edges.
 *
 * Apex tactic = no outgoing (no parent) → skip.
 * Leaf tactic = has outgoing, no incoming → warning.
 * Intermediate = has both → skip.
 */

describe('stTacticRollupRule', () => {
  it('does NOT fire on an apex tactic (no parent)', () => {
    resetIds();
    const apex = makeEntity({ type: 'injection', title: 'Apex strategy' });
    const doc = makeDoc([apex], [], 'st');
    expect(stTacticRollupRule(doc)).toHaveLength(0);
  });

  it('fires on a leaf tactic that has a parent but no children', () => {
    resetIds();
    const parent = makeEntity({ type: 'injection', title: 'Parent tactic' });
    const leaf = makeEntity({ type: 'injection', title: 'Leaf tactic' });
    const doc = makeDoc([parent, leaf], [makeEdge(leaf.id, parent.id)], 'st');
    const warnings = stTacticRollupRule(doc);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.ruleId).toBe('st-tactic-rollup');
    expect(warnings[0]?.target).toEqual({ kind: 'entity', id: leaf.id });
  });

  it('does NOT fire on an intermediate tactic (has both parent and children)', () => {
    resetIds();
    const parent = makeEntity({ type: 'injection', title: 'Parent' });
    const middle = makeEntity({ type: 'injection', title: 'Middle' });
    const child = makeEntity({ type: 'injection', title: 'Child' });
    const doc = makeDoc(
      [parent, middle, child],
      [makeEdge(middle.id, parent.id), makeEdge(child.id, middle.id)],
      'st'
    );
    // Only the leaf child should fire — the middle has both parent + child.
    const warnings = stTacticRollupRule(doc);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.target).toEqual({ kind: 'entity', id: child.id });
  });

  it('does NOT fire on non-injection entities (effects, etc.)', () => {
    resetIds();
    const parent = makeEntity({ type: 'injection', title: 'Tactic' });
    const effect = makeEntity({ type: 'effect', title: 'Some effect' });
    const doc = makeDoc([parent, effect], [makeEdge(effect.id, parent.id)], 'st');
    expect(stTacticRollupRule(doc)).toHaveLength(0);
  });

  it('does NOT fire on unspecified-placeholder tactics', () => {
    resetIds();
    const parent = makeEntity({ type: 'injection', title: 'Parent' });
    const leaf = makeEntity({
      type: 'injection',
      title: '',
      unspecified: true,
    });
    const doc = makeDoc([parent, leaf], [makeEdge(leaf.id, parent.id)], 'st');
    expect(stTacticRollupRule(doc)).toHaveLength(0);
  });

  it('handles a deeper chain — only the leaves fire', () => {
    resetIds();
    // apex ← middle ← leaf
    const apex = makeEntity({ type: 'injection', title: 'apex' });
    const middle = makeEntity({ type: 'injection', title: 'mid' });
    const leaf = makeEntity({ type: 'injection', title: 'leaf' });
    const doc = makeDoc(
      [apex, middle, leaf],
      [makeEdge(middle.id, apex.id), makeEdge(leaf.id, middle.id)],
      'st'
    );
    const warnings = stTacticRollupRule(doc);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.target).toEqual({ kind: 'entity', id: leaf.id });
  });

  it('is wired into the S&T diagram registry — surfaces via validate()', () => {
    resetIds();
    const parent = makeEntity({ type: 'injection', title: 'Parent' });
    const leaf = makeEntity({ type: 'injection', title: 'Leaf' });
    const doc = makeDoc([parent, leaf], [makeEdge(leaf.id, parent.id)], 'st');
    const warnings = validate(doc);
    const rollup = warnings.filter((w) => w.ruleId === 'st-tactic-rollup');
    expect(rollup).toHaveLength(1);
    expect(rollup[0]?.tier).toBe('sufficiency');
  });

  it('does NOT run on CRT diagrams (S&T-specific rule)', () => {
    resetIds();
    const parent = makeEntity({ type: 'injection', title: 'Parent' });
    const leaf = makeEntity({ type: 'injection', title: 'Leaf' });
    const doc = makeDoc([parent, leaf], [makeEdge(leaf.id, parent.id)], 'crt');
    const warnings = validate(doc);
    expect(warnings.some((w) => w.ruleId === 'st-tactic-rollup')).toBe(false);
  });
});
