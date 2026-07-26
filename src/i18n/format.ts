/**
 * Formatting helpers a locale catalogue uses to build interpolated strings.
 *
 * Each catalogue file bakes in its OWN BCP-47 tag when calling these (see
 * `locales/en.ts`), rather than receiving the active locale as an argument.
 * That keeps catalogue entries pure `(params) => string` functions — the
 * catalogue for a language already knows what language it is, so threading a
 * locale through every entry would be redundant and would make the
 * `Messages` signature harder to satisfy.
 */

/**
 * Plural selection via `Intl.PluralRules`, not a `n === 1 ? '' : 's'`
 * ternary. The ternary is what the pre-i18n code did (see the inline forms in
 * `crtUdeCount` / `goalTreeStructural`); it is correct for English and wrong
 * for languages with a zero, dual, few, or many category.
 *
 * `other` is required because every CLDR plural set has it — the remaining
 * categories are optional and fall back to it.
 */
export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

/**
 * Cache keys carry the OPTIONS as well as the locale, even though only one
 * option set exists at each construction site today. Keying on the locale alone
 * works right up until someone adds an ordinal plural or a conjunction list —
 * at which point the two configs silently share one cached formatter and the
 * bug looks like a locale problem rather than a cache problem.
 */
const pluralRulesCache = new Map<string, Intl.PluralRules>();

const pluralRulesFor = (locale: string): Intl.PluralRules => {
  const key = `${locale}|cardinal`;
  const hit = pluralRulesCache.get(key);
  if (hit) return hit;
  const rules = new Intl.PluralRules(locale, { type: 'cardinal' });
  pluralRulesCache.set(key, rules);
  return rules;
};

export const plural = (locale: string, count: number, forms: PluralForms): string =>
  forms[pluralRulesFor(locale).select(count)] ?? forms.other;

const listFormatCache = new Map<string, Intl.ListFormat>();

/**
 * List formatting, replacing the bare `missing.join(', ')` that hard-coded
 * English comma punctuation into `stTacticAssumptions`.
 *
 * `type: 'unit'` rather than `'conjunction'` deliberately. Conjunction adds
 * "and" plus, for en, the Oxford comma — which changes copy that reads fine
 * today ("necessary, parallel, sufficiency" became "necessary, parallel, and
 * sufficiency"). Unit keeps English byte-identical to the pre-i18n wording
 * while still deferring punctuation to the locale, which is the whole point:
 * da-DK yields "necessary, parallel og sufficiency" from the same call.
 */
export const formatList = (locale: string, items: readonly string[]): string => {
  const key = `${locale}|long|unit`;
  const hit = listFormatCache.get(key);
  const fmt = hit ?? new Intl.ListFormat(locale, { style: 'long', type: 'unit' });
  if (!hit) listFormatCache.set(key, fmt);
  return fmt.format(items);
};
