import { beforeEach, describe, expect, it } from 'vitest';
import { validate } from '@/domain/validators';
import { makeDoc, makeEntity, resetIds } from '../helpers';

beforeEach(() => {
  resetIds();
});

const RULE_ID = 'crt-ude-count';

const udeCountWarnings = (warnings: ReturnType<typeof validate>) =>
  warnings.filter((w) => w.ruleId === RULE_ID);

const udes = (n: number) => Array.from({ length: n }, () => makeEntity({ type: 'ude' }));

describe('CLR: crt-ude-count', () => {
  describe('too few UDEs (< 3)', () => {
    it('fires once with the "fewer than 3" message at a single UDE (singular wording)', () => {
      const warnings = validate(makeDoc(udes(1), [], 'crt'));
      const fired = udeCountWarnings(warnings);
      expect(fired).toHaveLength(1);
      // Singular: "1 UDE" with no trailing "s".
      expect(fired[0]?.message).toContain('This CRT has 1 UDE —');
      expect(fired[0]?.message).not.toContain('1 UDEs');
      expect(fired[0]?.message).toContain('with fewer than 3');
      expect(fired[0]?.message).toContain('Add the other effects');
    });

    it('targets the document, not any entity', () => {
      const warnings = validate(makeDoc(udes(1), [], 'crt'));
      const fired = udeCountWarnings(warnings);
      expect(fired[0]?.target).toEqual({ kind: 'document' });
    });

    it('uses plural wording at 2 UDEs (just below the threshold)', () => {
      const warnings = validate(makeDoc(udes(2), [], 'crt'));
      const fired = udeCountWarnings(warnings);
      expect(fired).toHaveLength(1);
      expect(fired[0]?.message).toContain('This CRT has 2 UDEs —');
      expect(fired[0]?.message).toContain('with fewer than 3');
    });
  });

  describe('within range (3–15): no warning', () => {
    it('does not fire at exactly 3 UDEs (lower boundary)', () => {
      const warnings = validate(makeDoc(udes(3), [], 'crt'));
      expect(udeCountWarnings(warnings)).toHaveLength(0);
    });

    it('does not fire mid-range (8 UDEs)', () => {
      const warnings = validate(makeDoc(udes(8), [], 'crt'));
      expect(udeCountWarnings(warnings)).toHaveLength(0);
    });

    it('does not fire at exactly 15 UDEs (upper boundary)', () => {
      const warnings = validate(makeDoc(udes(15), [], 'crt'));
      expect(udeCountWarnings(warnings)).toHaveLength(0);
    });
  });

  describe('too many UDEs (> 15)', () => {
    it('fires once with the "more than 15" message at 16 UDEs (just above the threshold)', () => {
      const warnings = validate(makeDoc(udes(16), [], 'crt'));
      const fired = udeCountWarnings(warnings);
      expect(fired).toHaveLength(1);
      expect(fired[0]?.message).toContain('This CRT has 16 UDEs —');
      expect(fired[0]?.message).toContain('more than 15');
      expect(fired[0]?.message).toContain('consider splitting it');
      // The "too many" branch must NOT use the "too few" copy.
      expect(fired[0]?.message).not.toContain('with fewer than');
    });

    it('targets the document at the high end too', () => {
      const warnings = validate(makeDoc(udes(20), [], 'crt'));
      const fired = udeCountWarnings(warnings);
      expect(fired).toHaveLength(1);
      expect(fired[0]?.target).toEqual({ kind: 'document' });
      expect(fired[0]?.message).toContain('This CRT has 20 UDEs —');
    });
  });

  describe('empty / no UDEs', () => {
    it('does not fire on a doc with zero UDEs (a brand-new CRT should not nag)', () => {
      const warnings = validate(makeDoc([], [], 'crt'));
      expect(udeCountWarnings(warnings)).toHaveLength(0);
    });

    it('does not fire when there are entities but none are UDEs', () => {
      // Two non-UDE entities — count of UDEs is 0, so the rule stays silent
      // even though the doc has nodes.
      const entities = [makeEntity({ type: 'effect' }), makeEntity({ type: 'rootCause' })];
      const warnings = validate(makeDoc(entities, [], 'crt'));
      expect(udeCountWarnings(warnings)).toHaveLength(0);
    });

    it('counts only UDE-typed entities (non-UDEs do not push the count into range)', () => {
      // 2 UDEs + 5 non-UDEs => UDE count is 2, still below MIN, so it fires.
      const entities = [...udes(2), ...Array.from({ length: 5 }, () => makeEntity())];
      const warnings = validate(makeDoc(entities, [], 'crt'));
      const fired = udeCountWarnings(warnings);
      expect(fired).toHaveLength(1);
      expect(fired[0]?.message).toContain('This CRT has 2 UDEs —');
    });
  });

  describe('diagram-type gating', () => {
    it('does not fire on a non-CRT diagram even with an out-of-range UDE count', () => {
      // 1 UDE would fire on a CRT, but the rule is CRT-only.
      const warnings = validate(makeDoc(udes(1), [], 'frt'));
      expect(udeCountWarnings(warnings)).toHaveLength(0);
    });
  });
});
