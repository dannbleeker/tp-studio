import type { ClrRuleId, ClrTier, TPDocument, Warning, WarningTarget } from '../types';

/**
 * Shared infrastructure for the per-rule CLR validator files. Each rule
 * file imports `makeWarning` + the relevant text/similarity helpers from
 * here and exports a `ValidatorRule` — `index.ts` composes them per
 * diagram type.
 */

/**
 * Warning shape *without* the `tier` field. Rule files don't know their
 * own tier (it's a composition concern, set in `validators/index.ts`'s
 * `tieredRule(...)` registry); they return this shape and `validate()`
 * stamps the tier on the way out. Keeping the boundary in the type
 * system makes a rule file accidentally hard-coding a tier a compile
 * error.
 */
export type UntieredWarning = Omit<Warning, 'tier'>;

/**
 * Raw rule function signature: doc in, warnings out. Used internally by the
 * tiered wrapper below and by tests that want to drive a single rule
 * directly without going through `validate()`.
 */
export type ValidatorRule = (doc: TPDocument) => UntieredWarning[];

/**
 * Tiered rule metadata for the three-level CLR taxonomy (Block C / E5).
 * Each rule declares which tier it belongs to so consumers like
 * `WarningsList` can group warnings under CLARITY / EXISTENCE /
 * SUFFICIENCY headers without re-deriving the mapping from rule ids.
 *
 *   - `clarity` — is the statement well-formed and unambiguous?
 *     (clarity, tautology)
 *   - `existence` — does the entity / edge / cycle structurally make
 *     sense? (entity-existence, causality-existence, predicted-effect-
 *     existence, cause-effect-reversal, indirect-effect, cycle)
 *   - `sufficiency` — does the cause actually produce the effect on its
 *     own? (cause-sufficiency, additional-cause)
 *
 * Tier assignment is per-rule; one rule file → one tier. Wrap the rule
 * function with `tieredRule(tier, ruleId, fn)` at export time.
 */
export type TieredRule = {
  tier: ClrTier;
  ruleId: ClrRuleId;
  fn: ValidatorRule;
};

/** Tag a validator function with its tier + rule id. */
export const tieredRule = (tier: ClrTier, ruleId: ClrRuleId, fn: ValidatorRule): TieredRule => ({
  tier,
  ruleId,
  fn,
});

const warningId = (ruleId: ClrRuleId, target: WarningTarget): string =>
  `${ruleId}:${target.kind}:${target.id}`;

/**
 * Build a `Warning` carrying the rule id, target, message, and a `resolved`
 * flag pulled from `doc.resolvedWarnings`. Stable ids let the user resolve
 * a warning once and have the resolution persist across re-validations.
 */
export const makeWarning = (
  doc: TPDocument,
  ruleId: ClrRuleId,
  target: WarningTarget,
  message: string
): UntieredWarning => {
  const id = warningId(ruleId, target);
  return {
    id,
    ruleId,
    message,
    target,
    resolved: doc.resolvedWarnings[id] === true,
  };
};

/** Word count over an entity title — splits on any whitespace run after a trim. */
export const countWords = (s: string): number => {
  const trimmed = s.trim();
  if (trimmed === '') return 0;
  return trimmed.split(/\s+/).length;
};

/**
 * Edit-distance between two strings, used by the tautology rule to flag
 * "this cause is just its effect restated." Uses Uint32Array rolling rows
 * for O(min(a, b)) memory instead of O(a * b).
 */
const levenshtein = (a: string, b: string): number => {
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;
  // Non-null assertions are safe here: every read index is bounded by the
  // surrounding loops (0..bl inclusive on prev/curr, and the init loop has
  // already filled prev[0..bl]).
  const prev = new Uint32Array(bl + 1);
  const curr = new Uint32Array(bl + 1);
  for (let j = 0; j <= bl; j++) prev[j] = j;
  for (let i = 1; i <= al; i++) {
    curr[0] = i;
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
    }
    for (let j = 0; j <= bl; j++) prev[j] = curr[j]!;
  }
  return prev[bl]!;
};

/**
 * `1 - normalizedLevenshtein` — a similarity score in [0, 1]. Compared
 * case-insensitively. Used by the tautology rule's threshold check.
 */
export const similarity = (a: string, b: string): number => {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a.toLowerCase(), b.toLowerCase()) / max;
};
