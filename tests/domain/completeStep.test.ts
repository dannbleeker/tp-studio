import { completeStepRule } from '@/domain/validators';
import { validate } from '@/domain/validators';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeDoc, makeEdge, makeEntity, resetIds } from './helpers';

beforeEach(() => {
  resetIds();
});

const hasRule = (warnings: ReturnType<typeof validate>, ruleId: string): boolean =>
  warnings.some((w) => w.ruleId === ruleId);

describe('CLR: TT complete-step rule (completeStepRule)', () => {
  it('fires when an action has no paired precondition on its outgoing edge', () => {
    // action → desiredEffect with no precondition. Should warn.
    const a = makeEntity({ type: 'action', title: 'Do the thing' });
    const de = makeEntity({ type: 'desiredEffect', title: 'Result' });
    const edge = makeEdge(a.id, de.id);
    const doc = makeDoc([a, de], [edge], 'tt');
    const warnings = completeStepRule(doc);
    expect(warnings.length).toBe(1);
    expect(warnings[0]?.target).toEqual({ kind: 'edge', id: edge.id });
  });

  it('does NOT fire when a non-action entity also feeds the same outcome', () => {
    // action + effect → desiredEffect. Effect plays the precondition role.
    const a = makeEntity({ type: 'action', title: 'Do the thing' });
    const pre = makeEntity({ type: 'effect', title: 'Existing condition holds' });
    const de = makeEntity({ type: 'desiredEffect', title: 'Result' });
    const e1 = makeEdge(a.id, de.id);
    const e2 = makeEdge(pre.id, de.id);
    const doc = makeDoc([a, pre, de], [e1, e2], 'tt');
    expect(completeStepRule(doc)).toEqual([]);
  });

  it('treats unspecified placeholder entities as valid preconditions', () => {
    // action + unspecified placeholder → desiredEffect. The placeholder
    // is a deliberate empty slot; the rule should treat it as filling
    // the precondition role.
    const a = makeEntity({ type: 'action', title: 'Do the thing' });
    const stub = makeEntity({ type: 'effect', title: '', unspecified: true });
    const de = makeEntity({ type: 'desiredEffect', title: 'Result' });
    const e1 = makeEdge(a.id, de.id);
    const e2 = makeEdge(stub.id, de.id);
    const doc = makeDoc([a, stub, de], [e1, e2], 'tt');
    expect(completeStepRule(doc)).toEqual([]);
  });

  it("does not count action siblings as preconditions (two actions ANDed isn't enough)", () => {
    const a1 = makeEntity({ type: 'action', title: 'Action 1' });
    const a2 = makeEntity({ type: 'action', title: 'Action 2' });
    const de = makeEntity({ type: 'desiredEffect', title: 'Result' });
    const e1 = makeEdge(a1.id, de.id);
    const e2 = makeEdge(a2.id, de.id);
    const doc = makeDoc([a1, a2, de], [e1, e2], 'tt');
    // Both edges should fire — neither action has a precondition sibling.
    const warnings = completeStepRule(doc);
    expect(warnings.length).toBe(2);
  });

  it('does not count assumption entities as preconditions', () => {
    const a = makeEntity({ type: 'action', title: 'Do the thing' });
    const assn = makeEntity({ type: 'assumption', title: 'we assume X' });
    const de = makeEntity({ type: 'desiredEffect', title: 'Result' });
    const e1 = makeEdge(a.id, de.id);
    const e2 = makeEdge(assn.id, de.id);
    const doc = makeDoc([a, assn, de], [e1, e2], 'tt');
    expect(completeStepRule(doc).length).toBe(1);
  });

  it('only registers in the TT diagram type', () => {
    // Same shape as the first test but in a CRT — should not surface
    // the rule because TT-specific rules are not in the CRT rule list.
    const a = makeEntity({ type: 'action', title: 'Do the thing' });
    const de = makeEntity({ type: 'desiredEffect', title: 'Result' });
    const edge = makeEdge(a.id, de.id);
    const docCrt = makeDoc([a, de], [edge], 'crt');
    expect(hasRule(validate(docCrt), 'complete-step')).toBe(false);
    // But the rule fires in TT.
    const docTt = makeDoc([a, de], [edge], 'tt');
    expect(hasRule(validate(docTt), 'complete-step')).toBe(true);
  });

  it('is tagged with the sufficiency tier', () => {
    const a = makeEntity({ type: 'action', title: 'Do the thing' });
    const de = makeEntity({ type: 'desiredEffect', title: 'Result' });
    const edge = makeEdge(a.id, de.id);
    const doc = makeDoc([a, de], [edge], 'tt');
    const ws = validate(doc).filter((w) => w.ruleId === 'complete-step');
    expect(ws[0]?.tier).toBe('sufficiency');
  });
});

describe('entity-existence rule + unspecified flag', () => {
  it('skips the empty-title check on entities flagged unspecified', () => {
    const a = makeEntity({ title: '', unspecified: true });
    const warnings = validate(makeDoc([a], []));
    expect(hasRule(warnings, 'entity-existence')).toBe(false);
  });

  it('still fires entity-existence on a normal empty-title entity', () => {
    const a = makeEntity({ title: '' });
    const warnings = validate(makeDoc([a], []));
    expect(hasRule(warnings, 'entity-existence')).toBe(true);
  });
});

describe('TT example doc round-trips Complete-Step cleanly', () => {
  // The example TT was rewritten in Session 53 to demonstrate the proper
  // Outcome ← (Action + Precondition) triple structure rather than a
  // flat action chain. This test pins that contract — loading the example
  // should surface zero `complete-step` warnings (every action has a
  // precondition sibling, including the deliberately-unspecified one) and
  // zero `entity-existence` warnings (the unspecified placeholder is exempt).
  it('produces no complete-step or entity-existence warnings', async () => {
    const { EXAMPLE_BY_DIAGRAM } = await import('@/domain/examples');
    const doc = EXAMPLE_BY_DIAGRAM.tt();
    const warnings = validate(doc);
    expect(hasRule(warnings, 'complete-step')).toBe(false);
    expect(hasRule(warnings, 'entity-existence')).toBe(false);
  });
});
