import { describe, expect, it } from 'vitest';
import { CLR_SCRUTINY } from '@/domain/clrScrutiny';
import type { ClrRuleId, ClrTier } from '@/domain/types';

// The canonical eight CLRs in scrutiny order, each paired with the tier it is
// registered under in `src/domain/validators/index.ts` (the `tieredRule(...)`
// calls). That registry is the source of truth — if a validator tier ever
// changes, update both it and this expectation so the scrutiny badge keeps
// agreeing with the Inspector's tiered warnings.
const EXPECTED: { ruleId: ClrRuleId; tier: ClrTier }[] = [
  { ruleId: 'clarity', tier: 'clarity' },
  { ruleId: 'entity-existence', tier: 'existence' },
  { ruleId: 'causality-existence', tier: 'existence' },
  { ruleId: 'cause-sufficiency', tier: 'sufficiency' },
  { ruleId: 'additional-cause', tier: 'sufficiency' },
  { ruleId: 'cause-effect-reversal', tier: 'existence' },
  { ruleId: 'predicted-effect-existence', tier: 'existence' },
  { ruleId: 'tautology', tier: 'clarity' },
];

describe('CLR_SCRUTINY — canonical scrutiny categories', () => {
  it('lists exactly the eight canonical CLRs in scrutiny order', () => {
    expect(CLR_SCRUTINY.map((c) => c.ruleId)).toEqual(EXPECTED.map((e) => e.ruleId));
  });

  it('tags each category with the same tier the validators use', () => {
    for (const exp of EXPECTED) {
      const cat = CLR_SCRUTINY.find((c) => c.ruleId === exp.ruleId);
      expect(cat?.tier, exp.ruleId).toBe(exp.tier);
    }
  });

  it('has no duplicate rule ids', () => {
    const ids = CLR_SCRUTINY.map((c) => c.ruleId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every category a non-empty label, question, and hint', () => {
    for (const c of CLR_SCRUTINY) {
      expect(c.label.trim().length, `${c.ruleId} label`).toBeGreaterThan(0);
      expect(c.question.trim().length, `${c.ruleId} question`).toBeGreaterThan(0);
      expect(c.hint.trim().length, `${c.ruleId} hint`).toBeGreaterThan(0);
    }
  });
});
