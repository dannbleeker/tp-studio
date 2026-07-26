import type { Messages } from './types';

/**
 * Pseudo-locale — a QA harness, not a language.
 *
 * Every string is derived from the English catalogue and wrapped in bracket
 * markers, so any text rendered by a converted surface is visibly tagged and
 * any text that ISN'T tagged is a literal that never went through the
 * catalogue. That turns "did we miss a string?" from an eyeball exercise into
 * an assertion a component test can make (see `tests/i18n/pseudoLocale.test.tsx`).
 *
 * Derived rather than authored, so it can never drift from `en` and costs a
 * wrapper function in its chunk instead of a second copy of every string.
 *
 * Reached only through the registry's dynamic `import()`, so it lands in its
 * own lazy chunk that production never loads.
 */

export const PSEUDO_PREFIX = '⟦';
export const PSEUDO_SUFFIX = '⟧';

const wrap = (value: string): string => `${PSEUDO_PREFIX}${value}${PSEUDO_SUFFIX}`;

/**
 * Interpolated catalogue entries are wrapped around their RESULT, not their
 * template, so the parameter values a validator passes through stay readable
 * inside the markers — a pseudo-localised warning still shows which entity it
 * is talking about.
 */
const pseudoValue = (value: unknown): unknown => {
  if (typeof value === 'string') return wrap(value);
  if (typeof value === 'function') {
    const fn = value as (...args: readonly unknown[]) => string;
    return (...args: readonly unknown[]): string => wrap(fn(...args));
  }
  // Before the plain-object branch: `typeof [] === 'object'`, so without this an
  // array-valued entry would come back as `{0: …, 1: …}` and a `.map()` at the
  // call site would throw. No catalogue entry is an array today; this is here so
  // that stays a harmless fact rather than a trap for the first one that is.
  if (Array.isArray(value)) return value.map(pseudoValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, pseudoValue(nested)])
    );
  }
  return value;
};

/**
 * The one cast in the module. `pseudoValue` walks an arbitrary object graph so
 * it cannot be generically typed, but it preserves every key and every value
 * KIND by construction — string for string, callable for callable, object for
 * object — so the output is `Messages` by shape.
 *
 * It does NOT preserve function arity: the wrapper is variadic, so `.length` is
 * 0 where the original may have been 1. Nothing reads `.length`, and `Messages`
 * does not constrain it, so the cast still holds — but don't reach for `.length`
 * as a discriminator anywhere in the i18n layer.
 */
export const pseudoMessages = (base: Messages): Messages => pseudoValue(base) as Messages;
