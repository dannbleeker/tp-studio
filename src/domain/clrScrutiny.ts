// Phase 3 #7 — guided CLR-scrutiny data. The canonical eight Categories of
// Legitimate Reservation (CLR), as a plain ordered list of *questions to ask*
// of a single cause→effect arrow.
//
// This is deliberately distinct from the `clr-walkthrough` overlay
// (`store/uiSlice/walkthroughSlice.ts`), which steps through the warnings that
// the validators *already fired* across the whole document. Scrutiny is the
// other direction: it walks every category in turn for ONE selected edge —
// including the ones nothing flagged — so the practitioner exercises the full
// reservation discipline Cohen describes, not just the auto-detected subset.
//
// Purely a guided-review surface: no schema change, no document mutation, no
// new persisted field. The dialog reads `validate(doc)` to surface any
// auto-flagged warnings for the edge under each category, but the category
// list itself is static reference data.

import { en } from '@/i18n/locales/en';
import type { Messages } from '@/i18n/types';
import type { ClrRuleId, ClrTier } from './types';

export type ClrScrutinyCategory = {
  /** The validator rule this category corresponds to. One of the eight
   *  canonical CLRs — a subset of `ClrRuleId`, so any auto-flagged warning
   *  on the edge can be matched back to its category by `ruleId`. */
  ruleId: ClrRuleId;
  /** The CLR tier, matched to the validator registry (`validators/index.ts`)
   *  so the badge a user sees here agrees with the Inspector's tiered list. */
  tier: ClrTier;
  /** Short human label for the category. */
  label: string;
  /** The reservation question to ask of the selected cause→effect arrow.
   *  Phrased generically ("the cause" / "the effect"); the dialog shows the
   *  actual entity titles in its header so the question reads in context. */
  question: string;
  /** A one-line nudge on what a satisfactory answer looks like / what to do
   *  if the reservation holds. */
  hint: string;
};

/**
 * The canonical eight CLRs in the order a practitioner walks them — from the
 * cheapest reservation (is it even clear?) through existence to sufficiency.
 * The `ruleId`s are exactly the first eight members of `ClrRuleId` (the
 * universal CLRs, before the diagram-specific extensions); the `tier`s mirror
 * the `tieredRule(...)` registrations in `domain/validators/index.ts`.
 */
const SCRUTINY_DEFS: Omit<ClrScrutinyCategory, 'label' | 'question' | 'hint'>[] = [
  {
    ruleId: 'clarity',
    tier: 'clarity',
  },
  {
    ruleId: 'entity-existence',
    tier: 'existence',
  },
  {
    ruleId: 'causality-existence',
    tier: 'existence',
  },
  {
    ruleId: 'cause-sufficiency',
    tier: 'sufficiency',
  },
  {
    ruleId: 'additional-cause',
    tier: 'sufficiency',
  },
  {
    ruleId: 'cause-effect-reversal',
    tier: 'existence',
  },
  {
    ruleId: 'predicted-effect-existence',
    tier: 'existence',
  },
  {
    ruleId: 'tautology',
    tier: 'clarity',
  },
];

/**
 * English view. React callers should use {@link scrutinyFor} so the stepper
 * follows the active locale; the copy itself lives in the catalogue keyed by
 * the same `ClrRuleId` the validators use.
 */
export const CLR_SCRUTINY: ClrScrutinyCategory[] = SCRUTINY_DEFS.map((d) => ({
  ...d,
  ...en.scrutiny[d.ruleId as keyof typeof en.scrutiny],
}));

/** Locale-aware scrutiny stepper. */
export const scrutinyFor = (messages: Messages): ClrScrutinyCategory[] =>
  SCRUTINY_DEFS.map((d) => ({
    ...d,
    ...messages.scrutiny[d.ruleId as keyof Messages['scrutiny']],
  }));
