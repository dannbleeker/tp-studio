import { beforeEach, describe, expect, it } from 'vitest';
import { validate } from '@/domain/validators';
import { makeDoc, makeEntity, resetIds } from '../helpers';

const RULE = 'tt-action-locus-unset';

beforeEach(() => {
  resetIds();
});

const locusWarnings = (warnings: ReturnType<typeof validate>) =>
  warnings.filter((w) => w.ruleId === RULE);

describe('CLR: tt-action-locus-unset', () => {
  it('fires on a TT action with no spanOfControl set', () => {
    const action = makeEntity({ type: 'action', title: 'Email the vendor' });
    const warnings = validate(makeDoc([action], [], 'tt'));
    const hits = locusWarnings(warnings);

    expect(hits).toHaveLength(1);
    const w = hits[0]!;
    expect(w.target.kind).toBe('entity');
    expect(w.target.kind === 'entity' && w.target.id).toBe(action.id);
    expect(w.ruleId).toBe(RULE);
    expect(w.tier).toBe('clarity');
    expect(w.message).toContain('Action has no locus set');
    expect(w.message).toContain('control / influence / external');
  });

  it('does NOT fire when spanOfControl is "control"', () => {
    const action = makeEntity({ type: 'action', spanOfControl: 'control' });
    const warnings = validate(makeDoc([action], [], 'tt'));
    expect(locusWarnings(warnings)).toHaveLength(0);
  });

  it('does NOT fire when spanOfControl is "influence"', () => {
    const action = makeEntity({ type: 'action', spanOfControl: 'influence' });
    const warnings = validate(makeDoc([action], [], 'tt'));
    expect(locusWarnings(warnings)).toHaveLength(0);
  });

  it('does NOT fire when spanOfControl is explicitly "external" (locus IS categorised)', () => {
    // The rule is "is the locus categorised at all?", not "is it the right
    // locus?" — explicit external is an allowed, intentional framing.
    const action = makeEntity({ type: 'action', spanOfControl: 'external' });
    const warnings = validate(makeDoc([action], [], 'tt'));
    expect(locusWarnings(warnings)).toHaveLength(0);
  });

  it('does NOT fire on an unspecified placeholder action even with no locus', () => {
    const action = makeEntity({ type: 'action', unspecified: true });
    const warnings = validate(makeDoc([action], [], 'tt'));
    expect(locusWarnings(warnings)).toHaveLength(0);
  });

  it('DOES fire when unspecified is explicitly false and locus is unset', () => {
    // Only `unspecified === true` exempts; false must still fire.
    const action = makeEntity({ type: 'action', unspecified: false });
    const warnings = validate(makeDoc([action], [], 'tt'));
    expect(locusWarnings(warnings)).toHaveLength(1);
  });

  it('does NOT fire on a non-action entity with no locus', () => {
    const effect = makeEntity({ type: 'effect' });
    const warnings = validate(makeDoc([effect], [], 'tt'));
    expect(locusWarnings(warnings)).toHaveLength(0);
  });

  it('does NOT fire on a non-action entity even when its type carries a locus field', () => {
    // rootCause supports spanOfControl too, but this rule keys on type==='action'.
    const rc = makeEntity({ type: 'rootCause' });
    const warnings = validate(makeDoc([rc], [], 'tt'));
    expect(locusWarnings(warnings)).toHaveLength(0);
  });

  it('fires once per qualifying action, targeting each by id', () => {
    const a1 = makeEntity({ type: 'action', title: 'A1' });
    const a2 = makeEntity({ type: 'action', title: 'A2' });
    const ok = makeEntity({ type: 'action', title: 'OK', spanOfControl: 'control' });
    const placeholder = makeEntity({ type: 'action', title: '', unspecified: true });
    const warnings = validate(makeDoc([a1, a2, ok, placeholder], [], 'tt'));
    const hits = locusWarnings(warnings);

    expect(hits).toHaveLength(2);
    const ids = hits.map((w) => (w.target.kind === 'entity' ? w.target.id : undefined)).sort();
    expect(ids).toEqual([a1.id, a2.id].sort());
  });

  it('does NOT fire on a non-TT diagram (rule is TT-only)', () => {
    // Same offending shape, but on a CRT — the per-diagram registry must
    // not run this rule outside TT.
    const action = makeEntity({ type: 'action', title: 'Email the vendor' });
    const crtWarnings = validate(makeDoc([action], [], 'crt'));
    expect(locusWarnings(crtWarnings)).toHaveLength(0);

    const frtWarnings = validate(makeDoc([action], [], 'frt'));
    expect(locusWarnings(frtWarnings)).toHaveLength(0);
  });

  it('marks the warning resolved when its id is in resolvedWarnings', () => {
    const action = makeEntity({ type: 'action', title: 'Email the vendor' });
    const warningId = `${RULE}:entity:${action.id}`;
    const warnings = validate(makeDoc([action], [], 'tt', { [warningId]: true }));
    const hits = locusWarnings(warnings);

    expect(hits).toHaveLength(1);
    expect(hits[0]!.id).toBe(warningId);
    expect(hits[0]!.resolved).toBe(true);
  });

  it('leaves the warning unresolved by default', () => {
    const action = makeEntity({ type: 'action', title: 'Email the vendor' });
    const warnings = validate(makeDoc([action], [], 'tt'));
    expect(locusWarnings(warnings)[0]!.resolved).toBe(false);
  });
});
