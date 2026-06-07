// Session 179 (Theme C) — the 7 Categories of Legitimate Reservation as a
// communication vocabulary for review comments. Tagging a comment with a CLR
// category turns "I disagree" into "I have a <category> reservation" — the
// non-threatening disagreement protocol Mabin's TP curriculum teaches.
//
// A deliberately narrow subset of `ClrRuleId` (the canonical 7; tautology — the
// informal 8th — is excluded, matching Mabin's framing). Kept standalone (not in
// clr.ts) so the comment model can depend on it without pulling the full rule-id
// union or the scrutiny stepper.

export type ClrCategory =
  | 'clarity'
  | 'entity-existence'
  | 'causality-existence'
  | 'cause-sufficiency'
  | 'additional-cause'
  | 'cause-effect-reversal'
  | 'predicted-effect-existence';

/** Canonical order — drives the dropdown + filter ordering. */
export const CLR_CATEGORIES: readonly ClrCategory[] = [
  'clarity',
  'entity-existence',
  'causality-existence',
  'cause-sufficiency',
  'additional-cause',
  'cause-effect-reversal',
  'predicted-effect-existence',
];

/** Short labels for the comment dropdown, badge, and filter. */
export const CLR_CATEGORY_LABELS: Record<ClrCategory, string> = {
  clarity: 'Clarity',
  'entity-existence': 'Entity existence',
  'causality-existence': 'Causality existence',
  'cause-sufficiency': 'Cause insufficiency',
  'additional-cause': 'Additional cause',
  'cause-effect-reversal': 'Cause-effect reversal',
  'predicted-effect-existence': 'Predicted-effect existence',
};

const CLR_CATEGORY_SET: ReadonlySet<string> = new Set(CLR_CATEGORIES);

export const isClrCategory = (x: unknown): x is ClrCategory =>
  typeof x === 'string' && CLR_CATEGORY_SET.has(x);
