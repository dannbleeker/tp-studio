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
export const CLR_SCRUTINY: ClrScrutinyCategory[] = [
  {
    ruleId: 'clarity',
    tier: 'clarity',
    label: 'Clarity',
    question:
      'Do you and your audience read the cause and the effect the same way? Is any word ambiguous, jargon, or open to a second interpretation?',
    hint: 'If a reasonable person could read it two ways, reword the entity until only one reading survives.',
  },
  {
    ruleId: 'entity-existence',
    tier: 'existence',
    label: 'Entity existence',
    question:
      'Do the cause and the effect each actually exist as stated — a real, present condition rather than a guess, a goal, or a label?',
    hint: 'Name the evidence you would point to. If the entity is a vague abstraction, restate it as something observable.',
  },
  {
    ruleId: 'causality-existence',
    tier: 'existence',
    label: 'Causality existence',
    question:
      'Does the cause genuinely lead to the effect — is the arrow real? Or are these just two things that happen together?',
    hint: 'Read it aloud: “If [cause], then [effect].” If that sounds forced, you may have correlation, not cause.',
  },
  {
    ruleId: 'cause-sufficiency',
    tier: 'sufficiency',
    label: 'Cause sufficiency',
    question:
      'Is the cause enough on its own to produce the effect, or is an unstated extra condition quietly required (a hidden AND)?',
    hint: 'If something else must also be true, add it as another cause feeding the same effect (an AND junctor).',
  },
  {
    ruleId: 'additional-cause',
    tier: 'sufficiency',
    label: 'Additional cause',
    question:
      'Could a separate, independent cause produce this same effect on its own (an OR)? Would removing this cause actually make the effect go away?',
    hint: 'If another cause alone would still produce the effect, draw it — fixing only this one will not be enough.',
  },
  {
    ruleId: 'cause-effect-reversal',
    tier: 'existence',
    label: 'Cause–effect reversal',
    question:
      'Are the cause and the effect the right way round? Could the arrow actually point the other way?',
    hint: 'Try reading the arrow backwards. If the reverse reads truer, flip the edge.',
  },
  {
    ruleId: 'predicted-effect-existence',
    tier: 'existence',
    label: 'Predicted-effect existence',
    question:
      'If the cause is real, what OTHER effect must also exist? Can you go and find that effect in reality?',
    hint: 'Name a side-effect the cause must produce, then check for it. Its absence challenges the cause.',
  },
  {
    ruleId: 'tautology',
    tier: 'clarity',
    label: 'Tautology (circular reasoning)',
    question:
      'Is the effect being used as the only proof of the cause — “it is true because it is true”? Is there independent evidence for the cause?',
    hint: 'Point to evidence for the cause that does not depend on the effect itself.',
  },
];
