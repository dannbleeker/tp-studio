import { describe, expect, it } from 'vitest';
import { actionEligibility } from '@/domain/actionEligibility';
import { propagateStates } from '@/domain/statePropagation';
import type { EntityState } from '@/domain/types';
import { makeDoc, makeEdge, makeEntity, resetIds } from './helpers';

/**
 * Session 135 — action-eligibility tests. The TT step is
 * `(Outcome ← Precondition + Action)`; eligibility folds the
 * preconditions' effective states. Each test seeds an action + a
 * precondition feeding a shared outcome and asserts the status.
 */

/** Build the canonical step: action A + precondition P both feed
 *  outcome O. Returns the ids + the doc. `pState` sets P's manual
 *  state. */
const seedStep = (pState?: EntityState) => {
  resetIds();
  const action = makeEntity({ type: 'action', title: 'Do the thing' });
  const precond = makeEntity({
    type: 'effect',
    title: 'Existing condition',
    ...(pState ? { state: pState } : {}),
  });
  const outcome = makeEntity({ type: 'effect', title: 'Outcome' });
  const doc = makeDoc(
    [action, precond, outcome],
    [makeEdge(action.id, outcome.id), makeEdge(precond.id, outcome.id)]
  );
  return { action, precond, outcome, doc };
};

const eligibilityOf = (doc: ReturnType<typeof seedStep>['doc'], actionId: string) =>
  actionEligibility(doc, propagateStates(doc), actionId);

describe('actionEligibility — status by precondition state', () => {
  it('eligible when the (only) precondition is true', () => {
    const { action, doc } = seedStep('true');
    const r = eligibilityOf(doc, action.id);
    expect(r.status).toBe('eligible');
    expect(r.preconditions).toHaveLength(1);
  });

  it('blocked when a precondition is false (names the offender)', () => {
    const { action, precond, doc } = seedStep('false');
    const r = eligibilityOf(doc, action.id);
    expect(r.status).toBe('blocked');
    expect(r.blockedBy?.id).toBe(precond.id);
  });

  it('pending when the precondition is unknown (no manual state, no propagation signal)', () => {
    const { action, doc } = seedStep(undefined);
    const r = eligibilityOf(doc, action.id);
    expect(r.status).toBe('pending');
  });

  it('pending when a precondition is disputed', () => {
    const { action, doc } = seedStep('disputed');
    expect(eligibilityOf(doc, action.id).status).toBe('pending');
  });

  it('na for an action with no precondition slot', () => {
    resetIds();
    const action = makeEntity({ type: 'action', title: 'Lone action' });
    const outcome = makeEntity({ type: 'effect', title: 'Outcome' });
    const doc = makeDoc([action, outcome], [makeEdge(action.id, outcome.id)]);
    expect(eligibilityOf(doc, action.id).status).toBe('na');
  });

  it('na for a non-action entity', () => {
    const { precond, doc } = seedStep('true');
    expect(eligibilityOf(doc, precond.id).status).toBe('na');
  });
});

describe('actionEligibility — multiple preconditions + folding', () => {
  it('blocked dominates when one of two preconditions is false', () => {
    resetIds();
    const action = makeEntity({ type: 'action', title: 'A' });
    const p1 = makeEntity({ type: 'effect', title: 'P1', state: 'true' });
    const p2 = makeEntity({ type: 'effect', title: 'P2', state: 'false' });
    const outcome = makeEntity({ type: 'effect', title: 'O' });
    const doc = makeDoc(
      [action, p1, p2, outcome],
      [makeEdge(action.id, outcome.id), makeEdge(p1.id, outcome.id), makeEdge(p2.id, outcome.id)]
    );
    const r = actionEligibility(doc, propagateStates(doc), action.id);
    expect(r.status).toBe('blocked');
    expect(r.blockedBy?.id).toBe(p2.id);
    expect(r.preconditions).toHaveLength(2);
  });

  it('eligible only when every precondition is true', () => {
    resetIds();
    const action = makeEntity({ type: 'action', title: 'A' });
    const p1 = makeEntity({ type: 'effect', title: 'P1', state: 'true' });
    const p2 = makeEntity({ type: 'effect', title: 'P2', state: 'true' });
    const outcome = makeEntity({ type: 'effect', title: 'O' });
    const doc = makeDoc(
      [action, p1, p2, outcome],
      [makeEdge(action.id, outcome.id), makeEdge(p1.id, outcome.id), makeEdge(p2.id, outcome.id)]
    );
    expect(actionEligibility(doc, propagateStates(doc), action.id).status).toBe('eligible');
  });

  it('ignores Action + Assumption siblings (only true preconditions count)', () => {
    resetIds();
    const action = makeEntity({ type: 'action', title: 'A' });
    const otherAction = makeEntity({ type: 'action', title: 'A2', state: 'false' });
    const assumption = makeEntity({ type: 'assumption', title: 'as', state: 'false' });
    const precond = makeEntity({ type: 'effect', title: 'P', state: 'true' });
    const outcome = makeEntity({ type: 'effect', title: 'O' });
    const doc = makeDoc(
      [action, otherAction, assumption, precond, outcome],
      [
        makeEdge(action.id, outcome.id),
        makeEdge(otherAction.id, outcome.id),
        makeEdge(assumption.id, outcome.id),
        makeEdge(precond.id, outcome.id),
      ]
    );
    const r = actionEligibility(doc, propagateStates(doc), action.id);
    // The false action/assumption siblings are NOT preconditions — only
    // the true `effect` is, so the step is eligible.
    expect(r.status).toBe('eligible');
    expect(r.preconditions).toHaveLength(1);
    expect(r.preconditions[0]?.id).toBe(precond.id);
  });

  it('a propagation-derived true precondition (no manual state) makes the action eligible', () => {
    resetIds();
    // upstream(true) → precond → outcome ← action. precond has no manual
    // state but derives true from upstream, so the action is eligible.
    const upstream = makeEntity({ type: 'effect', title: 'up', state: 'true' });
    const precond = makeEntity({ type: 'effect', title: 'P' });
    const action = makeEntity({ type: 'action', title: 'A' });
    const outcome = makeEntity({ type: 'effect', title: 'O' });
    const doc = makeDoc(
      [upstream, precond, action, outcome],
      [
        makeEdge(upstream.id, precond.id),
        makeEdge(precond.id, outcome.id),
        makeEdge(action.id, outcome.id),
      ]
    );
    expect(actionEligibility(doc, propagateStates(doc), action.id).status).toBe('eligible');
  });
});
