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
    const r = eligibilityOf(doc, precond.id);
    expect(r.status).toBe('na');
    // Session 135 mutation pass: assert the early-na return shape carries
    // an empty `preconditions` array — otherwise an ArrayDeclaration mutant
    // (`preconditions: [...]` → `preconditions: ['Stryker was here']`)
    // survives.
    expect(r.preconditions).toEqual([]);
  });

  it('na for a non-action entity short-circuits even when its outcome has other true preconditions', () => {
    // Session 135 mutation pass: without an effective na guard at the
    // top of the function (e.g. `||` → `&&`, `if(false)` mutants on line
    // 59), a non-action entity X whose outcome Y has a sibling true
    // precondition Z would compute eligibility (returning 'eligible')
    // instead of returning 'na' immediately. Two real preconditions on
    // the outcome force the function past the empty-preconditions
    // fallback if the guard were disabled.
    resetIds();
    const x = makeEntity({ type: 'effect', title: 'X' });
    const z = makeEntity({ type: 'effect', title: 'Z', state: 'true' });
    const y = makeEntity({ type: 'effect', title: 'Y' });
    const doc = makeDoc([x, z, y], [makeEdge(x.id, y.id), makeEdge(z.id, y.id)]);
    expect(actionEligibility(doc, propagateStates(doc), x.id).status).toBe('na');
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

  it('pending when one precondition is true and another is unknown (every guards both)', () => {
    // Session 135 mutation pass: `every` → `some` mutant survives unless
    // we test a mixed case. With `every`, one unknown sibling fails the
    // all-true check → pending. With `some`, the one true sibling
    // satisfies the check → eligible. Mixed true + unknown is the
    // diagnostic shape.
    resetIds();
    const action = makeEntity({ type: 'action', title: 'A' });
    const p1 = makeEntity({ type: 'effect', title: 'P1', state: 'true' });
    const p2 = makeEntity({ type: 'effect', title: 'P2' }); // unknown
    const outcome = makeEntity({ type: 'effect', title: 'O' });
    const doc = makeDoc(
      [action, p1, p2, outcome],
      [makeEdge(action.id, outcome.id), makeEdge(p1.id, outcome.id), makeEdge(p2.id, outcome.id)]
    );
    expect(actionEligibility(doc, propagateStates(doc), action.id).status).toBe('pending');
  });
});

describe('actionEligibility — non-causal edges (back-edge / mutex) are skipped', () => {
  // Session 135 mutation pass. The previous suite covered the happy
  // paths but never seeded back-edges / mutex markers on the action or
  // its outcomes, so the two filter guards survived as ConditionalExpression
  // + LogicalOperator mutants. These tests stress each filter directly.

  it('skips back-edges in the OUTGOING collection (the action does not feed that outcome)', () => {
    // action → realOutcome (eligible)
    // action → reinforcing (back-edge — the user marked it a feedback
    // loop, not a TT step). Without the filter, reinforcing's
    // false-stated precond would block the action. With the filter,
    // only realOutcome counts → eligible.
    resetIds();
    const action = makeEntity({ type: 'action', title: 'A' });
    const realOutcome = makeEntity({ type: 'effect', title: 'O1' });
    const reinforcing = makeEntity({ type: 'effect', title: 'O2' });
    const precondReal = makeEntity({ type: 'effect', title: 'P', state: 'true' });
    const precondReinf = makeEntity({ type: 'effect', title: 'PR', state: 'false' });
    const doc = makeDoc(
      [action, realOutcome, reinforcing, precondReal, precondReinf],
      [
        makeEdge(action.id, realOutcome.id),
        makeEdge(precondReal.id, realOutcome.id),
        makeEdge(action.id, reinforcing.id, { isBackEdge: true }),
        makeEdge(precondReinf.id, reinforcing.id),
      ]
    );
    expect(actionEligibility(doc, propagateStates(doc), action.id).status).toBe('eligible');
  });

  it('skips mutual-exclusion in the OUTGOING collection (EC marker, not a TT step)', () => {
    // Mirrors the back-edge test but with the mutex marker. Both flags
    // contribute to the LogicalOperator mutant on the OR — testing one
    // pins it. The asymmetry (only `isMutualExclusion=true`) kills the
    // `||` → `&&` mutant: with AND, the edge is NOT skipped because
    // isBackEdge is undefined/false.
    resetIds();
    const action = makeEntity({ type: 'action', title: 'A' });
    const realOutcome = makeEntity({ type: 'effect', title: 'O1' });
    const mutexOutcome = makeEntity({ type: 'effect', title: 'OM' });
    const precondReal = makeEntity({ type: 'effect', title: 'P', state: 'true' });
    const precondMutex = makeEntity({ type: 'effect', title: 'PM', state: 'false' });
    const doc = makeDoc(
      [action, realOutcome, mutexOutcome, precondReal, precondMutex],
      [
        makeEdge(action.id, realOutcome.id),
        makeEdge(precondReal.id, realOutcome.id),
        makeEdge(action.id, mutexOutcome.id, { isMutualExclusion: true }),
        makeEdge(precondMutex.id, mutexOutcome.id),
      ]
    );
    expect(actionEligibility(doc, propagateStates(doc), action.id).status).toBe('eligible');
  });

  it('skips back-edges in the INCOMING collection (a reinforcing-loop edge is not a precondition)', () => {
    // outcome has three incoming edges: action, real precond (true),
    // loop precond (false, back-edge). With the filter intact, only the
    // real precond counts → eligible. Without (bug), the false loop
    // precond joins → blocked.
    resetIds();
    const action = makeEntity({ type: 'action', title: 'A' });
    const outcome = makeEntity({ type: 'effect', title: 'O' });
    const precondReal = makeEntity({ type: 'effect', title: 'P', state: 'true' });
    const precondLoop = makeEntity({ type: 'effect', title: 'L', state: 'false' });
    const doc = makeDoc(
      [action, outcome, precondReal, precondLoop],
      [
        makeEdge(action.id, outcome.id),
        makeEdge(precondReal.id, outcome.id),
        makeEdge(precondLoop.id, outcome.id, { isBackEdge: true }),
      ]
    );
    expect(actionEligibility(doc, propagateStates(doc), action.id).status).toBe('eligible');
  });

  it('skips mutual-exclusion in the INCOMING collection (EC marker, not a precondition)', () => {
    // Pins the LogicalOperator on the OR (line 76). Only
    // `isMutualExclusion=true` set; `||` → `&&` would NOT skip the edge
    // (isBackEdge is undefined), letting the false precond join.
    resetIds();
    const action = makeEntity({ type: 'action', title: 'A' });
    const outcome = makeEntity({ type: 'effect', title: 'O' });
    const precondReal = makeEntity({ type: 'effect', title: 'P', state: 'true' });
    const precondMutex = makeEntity({ type: 'effect', title: 'M', state: 'false' });
    const doc = makeDoc(
      [action, outcome, precondReal, precondMutex],
      [
        makeEdge(action.id, outcome.id),
        makeEdge(precondReal.id, outcome.id),
        makeEdge(precondMutex.id, outcome.id, { isMutualExclusion: true }),
      ]
    );
    expect(actionEligibility(doc, propagateStates(doc), action.id).status).toBe('eligible');
  });
});

describe('actionEligibility — degenerate edge cases', () => {
  // Session 135 mutation pass — these stress the cheap guards that
  // otherwise survive `if(false)` mutations.

  it('skips orphaned incoming edges (sourceId points to a missing entity)', () => {
    // Without the `!src` guard, line 81's `src.type === 'action'` access
    // would throw TypeError on undefined and crash eligibility. The
    // guard lets the function recover and still return a sensible status
    // based on the surviving (real) preconditions.
    resetIds();
    const action = makeEntity({ type: 'action', title: 'A' });
    const precond = makeEntity({ type: 'effect', title: 'P', state: 'true' });
    const outcome = makeEntity({ type: 'effect', title: 'O' });
    // Edge built by hand so we can point at a non-existent source id.
    // The doc.entities map has no entry for `ghost`.
    const doc = makeDoc(
      [action, precond, outcome],
      [
        makeEdge(action.id, outcome.id),
        makeEdge(precond.id, outcome.id),
        // biome-ignore lint/suspicious/noExplicitAny: deliberate orphan-source for the test
        makeEdge('ghost-id' as any, outcome.id),
      ]
    );
    expect(() => actionEligibility(doc, propagateStates(doc), action.id)).not.toThrow();
    expect(actionEligibility(doc, propagateStates(doc), action.id).status).toBe('eligible');
  });

  it('de-duplicates a precondition that feeds two of the action outcomes', () => {
    // Action has two outcomes (O1, O2). One precondition (P) feeds
    // both. Without dedupe (line 82 mutant), P would be added twice
    // to the preconditions array.
    resetIds();
    const action = makeEntity({ type: 'action', title: 'A' });
    const precond = makeEntity({ type: 'effect', title: 'P', state: 'true' });
    const o1 = makeEntity({ type: 'effect', title: 'O1' });
    const o2 = makeEntity({ type: 'effect', title: 'O2' });
    const doc = makeDoc(
      [action, precond, o1, o2],
      [
        makeEdge(action.id, o1.id),
        makeEdge(action.id, o2.id),
        makeEdge(precond.id, o1.id),
        makeEdge(precond.id, o2.id),
      ]
    );
    const r = actionEligibility(doc, propagateStates(doc), action.id);
    expect(r.preconditions).toHaveLength(1);
    expect(r.preconditions[0]?.id).toBe(precond.id);
    expect(r.status).toBe('eligible');
  });
});
