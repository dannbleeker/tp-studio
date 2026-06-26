import { beforeEach, describe, expect, it } from 'vitest';
import { validate } from '@/domain/validators';
import { makeDoc, makeEdge, makeEntity, resetIds } from '../helpers';

beforeEach(() => {
  resetIds();
});

const RULE = 'complete-step';
const MESSAGE =
  'Action has no precondition — what existing condition lets it produce this outcome?';

const completeStepWarnings = (warnings: ReturnType<typeof validate>) =>
  warnings.filter((w) => w.ruleId === RULE);

describe('CLR: complete-step (TT)', () => {
  it('fires on an Action whose outcome has no non-action sibling', () => {
    const action = makeEntity({ type: 'action', title: 'Do the thing' });
    const outcome = makeEntity({ type: 'effect', title: 'The outcome' });
    const edge = makeEdge(action.id, outcome.id);
    const warnings = completeStepWarnings(validate(makeDoc([action, outcome], [edge], 'tt')));

    expect(warnings).toHaveLength(1);
    const w = warnings[0]!;
    expect(w.target).toEqual({ kind: 'edge', id: edge.id });
    expect(w.message).toBe(MESSAGE);
  });

  it('does NOT fire when the outcome also has a non-action precondition sibling', () => {
    const action = makeEntity({ type: 'action', title: 'Do the thing' });
    const precondition = makeEntity({ type: 'effect', title: 'Existing condition' });
    const outcome = makeEntity({ type: 'effect', title: 'The outcome' });
    const actionEdge = makeEdge(action.id, outcome.id);
    const preEdge = makeEdge(precondition.id, outcome.id);
    const warnings = completeStepWarnings(
      validate(makeDoc([action, precondition, outcome], [actionEdge, preEdge], 'tt'))
    );

    expect(warnings).toHaveLength(0);
  });

  it('still fires when the only sibling is ALSO an action (no precondition role filled)', () => {
    // Two actions both feed the outcome — neither plays the precondition
    // role, so BOTH action→outcome edges are flagged.
    const a1 = makeEntity({ type: 'action', title: 'Action one' });
    const a2 = makeEntity({ type: 'action', title: 'Action two' });
    const outcome = makeEntity({ type: 'effect', title: 'The outcome' });
    const e1 = makeEdge(a1.id, outcome.id);
    const e2 = makeEdge(a2.id, outcome.id);
    const warnings = completeStepWarnings(validate(makeDoc([a1, a2, outcome], [e1, e2], 'tt')));

    expect(warnings).toHaveLength(2);
    const targetIds = warnings.map((w) => w.target.kind === 'edge' && w.target.id).sort();
    expect(targetIds).toEqual([e1.id, e2.id].sort());
  });

  it('treats an unspecified placeholder entity as a valid precondition (does not fire)', () => {
    // An `unspecified: true` entity — even with an empty title — fills the
    // precondition slot deliberately, per the rule's docstring.
    const action = makeEntity({ type: 'action', title: 'Do the thing' });
    const placeholder = makeEntity({ type: 'effect', title: '', unspecified: true });
    const outcome = makeEntity({ type: 'effect', title: 'The outcome' });
    const actionEdge = makeEdge(action.id, outcome.id);
    const placeholderEdge = makeEdge(placeholder.id, outcome.id);
    const warnings = completeStepWarnings(
      validate(makeDoc([action, placeholder, outcome], [actionEdge, placeholderEdge], 'tt'))
    );

    expect(warnings).toHaveLength(0);
  });

  it('fires once per distinct outcome edge of the same action (dedup is per-edge)', () => {
    // One action feeds two separate preconditionless outcomes → two warnings,
    // one per edge.
    const action = makeEntity({ type: 'action', title: 'Do the thing' });
    const outcomeA = makeEntity({ type: 'effect', title: 'Outcome A' });
    const outcomeB = makeEntity({ type: 'effect', title: 'Outcome B' });
    const edgeA = makeEdge(action.id, outcomeA.id);
    const edgeB = makeEdge(action.id, outcomeB.id);
    const warnings = completeStepWarnings(
      validate(makeDoc([action, outcomeA, outcomeB], [edgeA, edgeB], 'tt'))
    );

    expect(warnings).toHaveLength(2);
    const targetIds = warnings.map((w) => w.target.kind === 'edge' && w.target.id).sort();
    expect(targetIds).toEqual([edgeA.id, edgeB.id].sort());
  });

  it('does NOT fire for non-action source entities (rule keys on action type)', () => {
    // A plain effect→effect chain has no Action, so the rule never fires
    // even though the outcome has no "precondition" sibling.
    const cause = makeEntity({ type: 'effect', title: 'Some cause' });
    const outcome = makeEntity({ type: 'effect', title: 'The outcome' });
    const edge = makeEdge(cause.id, outcome.id);
    const warnings = completeStepWarnings(validate(makeDoc([cause, outcome], [edge], 'tt')));

    expect(warnings).toHaveLength(0);
  });

  it('does NOT fire on a non-TT diagram type (rule is TT-only)', () => {
    const action = makeEntity({ type: 'action', title: 'Do the thing' });
    const outcome = makeEntity({ type: 'effect', title: 'The outcome' });
    const edge = makeEdge(action.id, outcome.id);
    // Same shape, but diagramType 'crt' — the rule is not registered there.
    const warnings = completeStepWarnings(validate(makeDoc([action, outcome], [edge], 'crt')));

    expect(warnings).toHaveLength(0);
  });

  it('does NOT count a sibling whose source entity is missing as a precondition', () => {
    // Edge from a deleted/absent source: src lookup returns undefined, so it
    // does NOT fill the precondition slot — the action edge still fires.
    const action = makeEntity({ type: 'action', title: 'Do the thing' });
    const outcome = makeEntity({ type: 'effect', title: 'The outcome' });
    const actionEdge = makeEdge(action.id, outcome.id);
    // Dangling sibling edge: its source entity is not in the doc.
    const danglingEdge = makeEdge('ghost-entity' as never, outcome.id);
    const warnings = completeStepWarnings(
      validate(makeDoc([action, outcome], [actionEdge, danglingEdge], 'tt'))
    );

    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.target).toEqual({ kind: 'edge', id: actionEdge.id });
  });

  it('does NOT fire on the action edge when a single non-action sibling fills the slot, even with another action sibling present', () => {
    // outcome fed by: action1 (the one under test), action2, and a real
    // precondition. The precondition fills the slot for every action edge,
    // so neither action edge fires.
    const action1 = makeEntity({ type: 'action', title: 'Action one' });
    const action2 = makeEntity({ type: 'action', title: 'Action two' });
    const precondition = makeEntity({ type: 'effect', title: 'Existing condition' });
    const outcome = makeEntity({ type: 'effect', title: 'The outcome' });
    const e1 = makeEdge(action1.id, outcome.id);
    const e2 = makeEdge(action2.id, outcome.id);
    const preEdge = makeEdge(precondition.id, outcome.id);
    const warnings = completeStepWarnings(
      validate(makeDoc([action1, action2, precondition, outcome], [e1, e2, preEdge], 'tt'))
    );

    expect(warnings).toHaveLength(0);
  });

  it('attaches no action affordance and reports an unresolved warning by default', () => {
    const action = makeEntity({ type: 'action', title: 'Do the thing' });
    const outcome = makeEntity({ type: 'effect', title: 'The outcome' });
    const edge = makeEdge(action.id, outcome.id);
    const warnings = completeStepWarnings(validate(makeDoc([action, outcome], [edge], 'tt')));

    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.action).toBeUndefined();
    expect(warnings[0]!.resolved).toBe(false);
  });

  it('reports the warning as resolved when its stable id is in resolvedWarnings', () => {
    const action = makeEntity({ type: 'action', title: 'Do the thing' });
    const outcome = makeEntity({ type: 'effect', title: 'The outcome' });
    const edge = makeEdge(action.id, outcome.id);
    const resolvedId = `${RULE}:edge:${edge.id}`;
    const warnings = completeStepWarnings(
      validate(makeDoc([action, outcome], [edge], 'tt', { [resolvedId]: true }))
    );

    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.resolved).toBe(true);
  });

  it('stamps the sufficiency tier on the warning', () => {
    const action = makeEntity({ type: 'action', title: 'Do the thing' });
    const outcome = makeEntity({ type: 'effect', title: 'The outcome' });
    const edge = makeEdge(action.id, outcome.id);
    const warnings = completeStepWarnings(validate(makeDoc([action, outcome], [edge], 'tt')));

    expect(warnings[0]!.tier).toBe('sufficiency');
  });
});
