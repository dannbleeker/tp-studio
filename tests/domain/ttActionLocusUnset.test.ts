import { describe, expect, it } from 'vitest';
import { validate } from '@/domain/validators';
import { ttActionLocusUnsetRule } from '@/domain/validators/ttActionLocusUnset';
import { makeDoc, makeEntity, resetIds } from './helpers';

/**
 * Session 135 — `tt-action-locus-unset` rule tests. The validator
 * fires on `action` entities that don't carry a `spanOfControl`
 * setting. Closed medium gap from NEXT_STEPS.
 */

describe('ttActionLocusUnsetRule', () => {
  it('fires on a plain action entity with no spanOfControl set', () => {
    resetIds();
    const a = makeEntity({ type: 'action', title: 'Refactor the queue handler' });
    const doc = makeDoc([a], [], 'tt');
    const warnings = ttActionLocusUnsetRule(doc);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.ruleId).toBe('tt-action-locus-unset');
    expect(warnings[0]?.target).toEqual({ kind: 'entity', id: a.id });
  });

  it('does NOT fire when spanOfControl is set to control', () => {
    resetIds();
    const a = makeEntity({
      type: 'action',
      title: 'Refactor the queue handler',
      spanOfControl: 'control',
    });
    const doc = makeDoc([a], [], 'tt');
    expect(ttActionLocusUnsetRule(doc)).toHaveLength(0);
  });

  it('does NOT fire when spanOfControl is set to influence', () => {
    resetIds();
    const a = makeEntity({ type: 'action', title: 'A', spanOfControl: 'influence' });
    expect(ttActionLocusUnsetRule(makeDoc([a], [], 'tt'))).toHaveLength(0);
  });

  it('does NOT fire when spanOfControl is set to external', () => {
    resetIds();
    const a = makeEntity({ type: 'action', title: 'A', spanOfControl: 'external' });
    expect(ttActionLocusUnsetRule(makeDoc([a], [], 'tt'))).toHaveLength(0);
  });

  it('does NOT fire on non-action entities (e.g. effects with no locus)', () => {
    resetIds();
    const e = makeEntity({ type: 'effect', title: 'Some effect, no locus' });
    expect(ttActionLocusUnsetRule(makeDoc([e], [], 'tt'))).toHaveLength(0);
  });

  it('does NOT fire on unspecified-placeholder actions', () => {
    resetIds();
    const a = makeEntity({ type: 'action', title: '', unspecified: true });
    expect(ttActionLocusUnsetRule(makeDoc([a], [], 'tt'))).toHaveLength(0);
  });

  it('fires per-action — three locus-less actions → three warnings', () => {
    resetIds();
    const a1 = makeEntity({ type: 'action', title: 'A1' });
    const a2 = makeEntity({ type: 'action', title: 'A2' });
    const a3 = makeEntity({ type: 'action', title: 'A3' });
    expect(ttActionLocusUnsetRule(makeDoc([a1, a2, a3], [], 'tt'))).toHaveLength(3);
  });

  it('is wired into the TT diagram registry — surfaces via validate()', () => {
    resetIds();
    const a = makeEntity({ type: 'action', title: 'Refactor the queue handler' });
    const doc = makeDoc([a], [], 'tt');
    const warnings = validate(doc);
    const locus = warnings.filter((w) => w.ruleId === 'tt-action-locus-unset');
    expect(locus).toHaveLength(1);
    // Tier is 'clarity' (set by the registry in validators/index.ts).
    expect(locus[0]?.tier).toBe('clarity');
  });

  it('does NOT run on CRT diagrams (TT-specific rule)', () => {
    resetIds();
    const a = makeEntity({ type: 'action', title: 'Some action on a CRT' });
    const doc = makeDoc([a], [], 'crt');
    const warnings = validate(doc);
    expect(warnings.some((w) => w.ruleId === 'tt-action-locus-unset')).toBe(false);
  });
});
