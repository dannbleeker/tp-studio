import { describe, expect, it } from 'vitest';
import { resolveClrActionLabel, resolveClrMessage } from '@/i18n/clr';
import { formatList, plural } from '@/i18n/format';
import {
  BCP47_BY_LOCALE,
  isLocale,
  LOCALE_LABEL,
  LOCALES,
  SELECTABLE_LOCALES,
} from '@/i18n/locale';
import { en } from '@/i18n/locales/en';
import type { Messages } from '@/i18n/types';

/**
 * Architecture guarantees for the message catalogue. The completeness
 * guarantee itself is a TYPE-level one — see the `@ts-expect-error` block
 * below, which `tsc --noEmit` (preflight step 1) enforces over `tests/`.
 */

describe('locale union', () => {
  it('offers only shipping locales in Settings — the QA pseudo-locale is not a product choice', () => {
    expect(SELECTABLE_LOCALES).toEqual(['en']);
    expect(LOCALES).toContain('pseudo');
    expect(SELECTABLE_LOCALES).not.toContain('pseudo');
  });

  it('names every locale in the union', () => {
    for (const locale of LOCALES) {
      expect(LOCALE_LABEL[locale]).toBeTruthy();
      expect(BCP47_BY_LOCALE[locale]).toBeTruthy();
    }
  });

  it('guards the trust boundary against tampered values', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('de')).toBe(false);
    expect(isLocale('')).toBe(false);
    expect(isLocale(null)).toBe(false);
    expect(isLocale(42)).toBe(false);
    expect(isLocale({ toString: () => 'en' })).toBe(false);
  });
});

describe('type-level completeness', () => {
  it('rejects a locale that is missing a key', () => {
    // A catalogue missing `clr` (and everything else) is not assignable to
    // `Messages`. If the shape ever stopped being enforced, the directive
    // below would become unused and `tsc` would fail on THAT — so this test
    // cannot silently rot into a no-op.
    // @ts-expect-error — incomplete locale: every key of `Messages` is required.
    const incomplete: Messages = { settings: en.settings };
    expect(incomplete).toBeTruthy();
  });

  it('rejects an interpolated entry whose signature does not match', () => {
    // @ts-expect-error — `clarity.too-long` is `(params) => string`, not a bare string.
    const wrongShape: Messages['clr']['clarity.too-long'] = 'a plain string';
    expect(wrongShape).toBeTruthy();
  });
});

describe('resolveClrMessage', () => {
  it('returns static copy verbatim', () => {
    expect(resolveClrMessage(en, 'causality-existence')).toBe(
      'Does the cause inevitably produce the effect?'
    );
  });

  it('interpolates parameters', () => {
    expect(resolveClrMessage(en, 'clarity.too-long', { limit: 25 })).toContain('over 25 words');
  });

  it('does not throw when an interpolated entry is called without params', () => {
    // Defensive: a partially-translated locale could route here with nothing.
    expect(() => resolveClrMessage(en, 'clarity.too-long')).not.toThrow();
  });

  it('resolves one-click remedy labels from the action id', () => {
    expect(resolveClrActionLabel(en, 'insert-step')).toBe('Insert a step');
  });
});

describe('plural + list formatting', () => {
  it('selects the English plural category rather than an n === 1 ternary', () => {
    const forms = { one: 'UDE', other: 'UDEs' };
    expect(plural('en', 1, forms)).toBe('UDE');
    expect(plural('en', 0, forms)).toBe('UDEs');
    expect(plural('en', 7, forms)).toBe('UDEs');
  });

  it('falls back to `other` for a category a locale does not define', () => {
    expect(plural('en', 2, { other: 'many' })).toBe('many');
  });

  it('defers list punctuation to the locale without altering English copy', () => {
    // `type: 'unit'` — English stays exactly as the pre-i18n `join(', ')`
    // produced it, with no conjunction and no Oxford comma, while a locale
    // that punctuates lists differently still gets its own rendering.
    expect(formatList('en', ['a', 'b', 'c'])).toBe('a, b, c');
    expect(formatList('en', ['solo'])).toBe('solo');
    expect(formatList('da', ['a', 'b', 'c'])).toBe('a, b og c');
  });
});
