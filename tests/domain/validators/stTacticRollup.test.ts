import { beforeEach, describe, expect, it } from 'vitest';
import { validate } from '@/domain/validators';
import { makeDoc, makeEdge, makeEntity, resetIds } from '../helpers';

beforeEach(() => {
  resetIds();
});

const RULE = 'st-tactic-rollup';

const rollupWarnings = (warnings: ReturnType<typeof validate>) =>
  warnings.filter((w) => w.ruleId === RULE);

// Edge convention in S&T: a child tactic feeds (is the source of an edge into)
// its parent tactic. So makeEdge(child, parent) gives the child an *outgoing*
// edge (it has a parent) and the parent an *incoming* edge (it has children).
//
// Fire condition for st-tactic-rollup on an `injection` entity e:
//   - has outgoing edges (a parent exists), AND
//   - has NO incoming edges (no child tactics).
// i.e. a leaf tactic that is not the apex.

describe('CLR st-tactic-rollup: positive (leaf tactic fires)', () => {
  it('fires on a non-apex injection with a parent but no children', () => {
    const apex = makeEntity({ type: 'injection', title: 'Top tactic' });
    const leaf = makeEntity({ type: 'injection', title: 'Leaf tactic' });
    // leaf feeds apex → leaf has outgoing, no incoming.
    const edge = makeEdge(leaf.id, apex.id);
    const warnings = validate(makeDoc([apex, leaf], [edge], 'st'));
    const fired = rollupWarnings(warnings);

    expect(fired).toHaveLength(1);
    const w = fired[0]!;
    expect(w.ruleId).toBe(RULE);
    expect(w.tier).toBe('sufficiency');
    expect(w.target).toEqual({ kind: 'entity', id: leaf.id });
    expect(w.message).toContain('Tactic has a parent but no child tactics');
    expect(w.message).toContain('decompose into sufficient sub-tactics');
    expect(w.resolved).toBe(false);
  });

  it('fires once per leaf tactic when several leaves feed one parent', () => {
    const apex = makeEntity({ type: 'injection', title: 'Top tactic' });
    const leafA = makeEntity({ type: 'injection', title: 'Leaf A' });
    const leafB = makeEntity({ type: 'injection', title: 'Leaf B' });
    const eA = makeEdge(leafA.id, apex.id);
    const eB = makeEdge(leafB.id, apex.id);
    const warnings = validate(makeDoc([apex, leafA, leafB], [eA, eB], 'st'));
    const fired = rollupWarnings(warnings);

    expect(fired).toHaveLength(2);
    const ids = fired.map((w) => (w.target.kind === 'entity' ? w.target.id : undefined)).sort();
    expect(ids).toEqual([leafA.id, leafB.id].sort());
    // The apex (no outgoing) never fires.
    expect(ids).not.toContain(apex.id);
  });

  it('reports resolved=true when the warning id is in resolvedWarnings', () => {
    const apex = makeEntity({ type: 'injection', title: 'Top tactic' });
    const leaf = makeEntity({ type: 'injection', title: 'Leaf tactic' });
    const edge = makeEdge(leaf.id, apex.id);
    const warnId = `${RULE}:entity:${leaf.id}`;
    const warnings = validate(makeDoc([apex, leaf], [edge], 'st', { [warnId]: true }));
    const fired = rollupWarnings(warnings);

    expect(fired).toHaveLength(1);
    expect(fired[0]!.resolved).toBe(true);
  });
});

describe('CLR st-tactic-rollup: negative (must not fire)', () => {
  it('does NOT fire on an apex tactic (no outgoing edges / no parent)', () => {
    // apex is the target of leaf's edge → apex has incoming but no outgoing.
    const apex = makeEntity({ type: 'injection', title: 'Apex tactic' });
    const leaf = makeEntity({ type: 'injection', title: 'Leaf tactic' });
    const edge = makeEdge(leaf.id, apex.id);
    const warnings = validate(makeDoc([apex, leaf], [edge], 'st'));
    const fired = rollupWarnings(warnings);

    // Only the leaf fires; the apex is skipped.
    const apexFired = fired.filter((w) => w.target.kind === 'entity' && w.target.id === apex.id);
    expect(apexFired).toHaveLength(0);
  });

  it('does NOT fire on an intermediate tactic (has both parent and children)', () => {
    // mid feeds apex (outgoing) AND leaf feeds mid (incoming) → skipped.
    const apex = makeEntity({ type: 'injection', title: 'Apex tactic' });
    const mid = makeEntity({ type: 'injection', title: 'Mid tactic' });
    const leaf = makeEntity({ type: 'injection', title: 'Leaf tactic' });
    const midToApex = makeEdge(mid.id, apex.id);
    const leafToMid = makeEdge(leaf.id, mid.id);
    const warnings = validate(makeDoc([apex, mid, leaf], [midToApex, leafToMid], 'st'));
    const fired = rollupWarnings(warnings);

    const midFired = fired.filter((w) => w.target.kind === 'entity' && w.target.id === mid.id);
    expect(midFired).toHaveLength(0);
    // Only the genuine leaf fires.
    expect(fired).toHaveLength(1);
    expect(fired[0]!.target).toEqual({ kind: 'entity', id: leaf.id });
  });

  it('does NOT fire on a non-injection leaf (e.g. an action)', () => {
    const apex = makeEntity({ type: 'injection', title: 'Top tactic' });
    const leaf = makeEntity({ type: 'action', title: 'Action leaf' });
    const edge = makeEdge(leaf.id, apex.id);
    const warnings = validate(makeDoc([apex, leaf], [edge], 'st'));
    const fired = rollupWarnings(warnings);

    expect(fired).toHaveLength(0);
  });

  it('does NOT fire on an unspecified placeholder injection leaf', () => {
    const apex = makeEntity({ type: 'injection', title: 'Top tactic' });
    const leaf = makeEntity({
      type: 'injection',
      title: 'Placeholder',
      unspecified: true,
    });
    const edge = makeEdge(leaf.id, apex.id);
    const warnings = validate(makeDoc([apex, leaf], [edge], 'st'));
    const fired = rollupWarnings(warnings);

    expect(fired).toHaveLength(0);
  });

  it('does NOT fire on the same leaf shape when the diagram is not S&T', () => {
    // Identical structure but diagramType 'crt' → rule not registered.
    const apex = makeEntity({ type: 'injection', title: 'Top tactic' });
    const leaf = makeEntity({ type: 'injection', title: 'Leaf tactic' });
    const edge = makeEdge(leaf.id, apex.id);
    const warnings = validate(makeDoc([apex, leaf], [edge], 'crt'));
    const fired = rollupWarnings(warnings);

    expect(fired).toHaveLength(0);
  });

  it('does NOT fire on a completely isolated injection (no edges at all)', () => {
    // No outgoing → apex-like → skipped even though it has no children.
    const lone = makeEntity({ type: 'injection', title: 'Lone tactic' });
    const warnings = validate(makeDoc([lone], [], 'st'));
    const fired = rollupWarnings(warnings);

    expect(fired).toHaveLength(0);
  });
});
