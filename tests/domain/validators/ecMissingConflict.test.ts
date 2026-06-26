import { beforeEach, describe, expect, it } from 'vitest';
import { validate } from '@/domain/validators';
import { makeDoc, makeEdge, makeEntity, resetIds } from '../helpers';

beforeEach(() => {
  resetIds();
});

const RULE = 'ec-missing-conflict';

const conflictWarnings = (warnings: ReturnType<typeof validate>) =>
  warnings.filter((w) => w.ruleId === RULE);

// NOTE on titles: `validate()` memoizes on a fingerprint that includes
// per-entity ids/types/titles + edge endpoints but NOT `isMutualExclusion`
// (see src/domain/fingerprint.ts — flagged in this task's suspectedBug). To
// keep each test's result independent of the others' cache entries, every
// test below uses DISTINCT entity titles so no two docs ever share a
// fingerprint. This is a test-hygiene workaround, not an assertion weakening.

describe('CLR: ec-missing-conflict', () => {
  it('fires once on an EC with two Wants and no mutual-exclusion edge', () => {
    const w1 = makeEntity({ type: 'want', title: 'Cut prices now' });
    const w2 = makeEntity({ type: 'want', title: 'Hold prices firm' });
    const warnings = validate(makeDoc([w1, w2], [], 'ec'));
    const found = conflictWarnings(warnings);

    expect(found.length).toBe(1);
    const warning = found[0]!;
    expect(warning.tier).toBe('existence');
    expect(warning.target).toEqual({ kind: 'entity', id: w1.id });
    expect(warning.message).toBe(
      'No mutual-exclusion edge between the two Wants — is this really a conflict?'
    );
    expect(warning.resolved).toBe(false);
  });

  it('targets the lowest-annotationNumber Want regardless of map order', () => {
    // w1 created first → lower annotationNumber; rule must point at it
    // even when w2 is listed first in the entities array.
    const w1 = makeEntity({ type: 'want', title: 'Lowest annotation want' });
    const w2 = makeEntity({ type: 'want', title: 'Higher annotation want' });
    expect(w1.annotationNumber).toBeLessThan(w2.annotationNumber);

    const warnings = validate(makeDoc([w2, w1], [], 'ec'));
    const found = conflictWarnings(warnings);
    expect(found.length).toBe(1);
    expect(found[0]!.target).toEqual({ kind: 'entity', id: w1.id });
  });

  it('does NOT fire when only one Want exists (just below the threshold)', () => {
    const only = makeEntity({ type: 'want', title: 'Sole lonely want' });
    const need = makeEntity({ type: 'need', title: 'Underlying need one' });
    const warnings = validate(makeDoc([only, need], [], 'ec'));
    expect(conflictWarnings(warnings).length).toBe(0);
  });

  it('does NOT fire on an EC with zero Wants', () => {
    const need = makeEntity({ type: 'need', title: 'Underlying need two' });
    const goal = makeEntity({ type: 'goal', title: 'The shared objective' });
    const warnings = validate(makeDoc([need, goal], [], 'ec'));
    expect(conflictWarnings(warnings).length).toBe(0);
  });

  it('fires with exactly two Wants (boundary at the threshold)', () => {
    const w1 = makeEntity({ type: 'want', title: 'Boundary want alpha' });
    const w2 = makeEntity({ type: 'want', title: 'Boundary want beta' });
    const warnings = validate(makeDoc([w1, w2], [], 'ec'));
    expect(conflictWarnings(warnings).length).toBe(1);
  });

  it('fires with three Wants and no mutual-exclusion edge', () => {
    const w1 = makeEntity({ type: 'want', title: 'Triple want one' });
    const w2 = makeEntity({ type: 'want', title: 'Triple want two' });
    const w3 = makeEntity({ type: 'want', title: 'Triple want three' });
    const warnings = validate(makeDoc([w1, w2, w3], [], 'ec'));
    const found = conflictWarnings(warnings);
    // Still exactly one warning, anchored to the lowest-numbered Want.
    expect(found.length).toBe(1);
    expect(found[0]!.target).toEqual({ kind: 'entity', id: w1.id });
  });

  it('does NOT fire when a mutual-exclusion edge connects the two Wants', () => {
    const w1 = makeEntity({ type: 'want', title: 'Mutex cleared want a' });
    const w2 = makeEntity({ type: 'want', title: 'Mutex cleared want b' });
    const mutex = makeEdge(w1.id, w2.id, { isMutualExclusion: true });
    const warnings = validate(makeDoc([w1, w2], [mutex], 'ec'));
    expect(conflictWarnings(warnings).length).toBe(0);
  });

  it('STILL fires when an edge between the Wants has isMutualExclusion false', () => {
    // An ordinary edge between the Wants is not the explicit conflict
    // marker — only `isMutualExclusion: true` clears the warning.
    const w1 = makeEntity({ type: 'want', title: 'False flag want a' });
    const w2 = makeEntity({ type: 'want', title: 'False flag want b' });
    const plain = makeEdge(w1.id, w2.id, { isMutualExclusion: false });
    const warnings = validate(makeDoc([w1, w2], [plain], 'ec'));
    expect(conflictWarnings(warnings).length).toBe(1);
  });

  it('STILL fires when isMutualExclusion is undefined on the edge between the Wants', () => {
    const w1 = makeEntity({ type: 'want', title: 'Undef flag want a' });
    const w2 = makeEntity({ type: 'want', title: 'Undef flag want b' });
    const plain = makeEdge(w1.id, w2.id);
    const warnings = validate(makeDoc([w1, w2], [plain], 'ec'));
    expect(conflictWarnings(warnings).length).toBe(1);
  });

  it('STILL fires when a mutex edge does NOT connect two Wants (one endpoint is a Need)', () => {
    // The mutex flag must sit on an edge whose BOTH endpoints are Wants.
    // A mutex edge between a Want and a Need does not count.
    const w1 = makeEntity({ type: 'want', title: 'Wrong endpoint want a' });
    const w2 = makeEntity({ type: 'want', title: 'Wrong endpoint want b' });
    const need = makeEntity({ type: 'need', title: 'Wrong endpoint need' });
    const wrongMutex = makeEdge(w1.id, need.id, { isMutualExclusion: true });
    const warnings = validate(makeDoc([w1, w2, need], [wrongMutex], 'ec'));
    expect(conflictWarnings(warnings).length).toBe(1);
  });

  it('counts a custom class with supersetOf "want" toward the Want pair', () => {
    // B3: a custom entity class declaring `supersetOf: 'want'` behaves as
    // a Want for this rule, so one built-in Want + one custom-Want = a pair.
    const builtinWant = makeEntity({ type: 'want', title: 'Builtin pair want' });
    const customWant = makeEntity({ type: 'strategy' as never, title: 'Custom pair want' });
    const doc = makeDoc([builtinWant, customWant], [], 'ec');
    doc.customEntityClasses = {
      strategy: { id: 'strategy', label: 'Strategy', supersetOf: 'want' },
    };
    const warnings = validate(doc);
    expect(conflictWarnings(warnings).length).toBe(1);
  });

  it('does NOT count a custom class WITHOUT supersetOf "want" (single real Want)', () => {
    // The custom class has no supersetOf, so only the one built-in Want
    // counts — below the two-Want threshold, no warning.
    const builtinWant = makeEntity({ type: 'want', title: 'Solo builtin want' });
    const decorative = makeEntity({ type: 'evidence' as never, title: 'Decorative class node' });
    const doc = makeDoc([builtinWant, decorative], [], 'ec');
    doc.customEntityClasses = {
      evidence: { id: 'evidence', label: 'Evidence' },
    };
    const warnings = validate(doc);
    expect(conflictWarnings(warnings).length).toBe(0);
  });

  it('does NOT fire when a mutex edge joins a built-in Want and a custom Want', () => {
    const builtinWant = makeEntity({ type: 'want', title: 'Builtin mutex want' });
    const customWant = makeEntity({ type: 'strategy' as never, title: 'Custom mutex want' });
    const mutex = makeEdge(builtinWant.id, customWant.id, { isMutualExclusion: true });
    const doc = makeDoc([builtinWant, customWant], [mutex], 'ec');
    doc.customEntityClasses = {
      strategy: { id: 'strategy', label: 'Strategy', supersetOf: 'want' },
    };
    const warnings = validate(doc);
    expect(conflictWarnings(warnings).length).toBe(0);
  });

  it('does NOT run on a non-EC diagram even with two unmarked Wants', () => {
    const w1 = makeEntity({ type: 'want', title: 'Non ec want a' });
    const w2 = makeEntity({ type: 'want', title: 'Non ec want b' });
    const warnings = validate(makeDoc([w1, w2], [], 'crt'));
    expect(conflictWarnings(warnings).length).toBe(0);
  });

  it('marks the warning resolved when the user has dismissed it', () => {
    const w1 = makeEntity({ type: 'want', title: 'Resolved want a' });
    const w2 = makeEntity({ type: 'want', title: 'Resolved want b' });
    const warningId = `${RULE}:entity:${w1.id}`;
    const doc = makeDoc([w1, w2], [], 'ec', { [warningId]: true });
    const warnings = validate(doc);
    const found = conflictWarnings(warnings);
    expect(found.length).toBe(1);
    expect(found[0]!.resolved).toBe(true);
  });
});
