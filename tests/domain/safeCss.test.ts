import { describe, expect, it } from 'vitest';
import { isSafeCssColor } from '@/domain/safeCss';

/**
 * M-Sec1 — `customEntityClass.color` is interpolated into the HTML export's
 * inline `style` attribute, so it must be a real CSS color and not a string
 * that injects an extra declaration (e.g. a `;background-image:url(...)`
 * external-resource beacon that `escapeHtml` doesn't neutralise).
 * `isSafeCssColor` is the allowlist gate.
 */
describe('isSafeCssColor', () => {
  it('allows hex colors (3/4/6/8 digit, any case)', () => {
    expect(isSafeCssColor('#abc')).toBe(true);
    expect(isSafeCssColor('#aabbcc')).toBe(true);
    expect(isSafeCssColor('#aabbccdd')).toBe(true);
    expect(isSafeCssColor('#6366F1')).toBe(true);
  });

  it('allows rgb/rgba/hsl/hsla with purely numeric content', () => {
    expect(isSafeCssColor('rgb(255, 0, 0)')).toBe(true);
    expect(isSafeCssColor('rgba(0,0,0,0.5)')).toBe(true);
    expect(isSafeCssColor('hsl(210, 50%, 40%)')).toBe(true);
    expect(isSafeCssColor('rgb(255 0 0 / 50%)')).toBe(true);
  });

  it('allows curated named colors (case-insensitive)', () => {
    expect(isSafeCssColor('red')).toBe(true);
    expect(isSafeCssColor('Transparent')).toBe(true);
    expect(isSafeCssColor('indigo')).toBe(true);
  });

  it('rejects a value that injects an extra declaration / beacon', () => {
    expect(isSafeCssColor('red;background-image:url(http://x/y.png)')).toBe(false);
    expect(isSafeCssColor('red;}body{display:none')).toBe(false);
    expect(isSafeCssColor('url(http://x/y.png)')).toBe(false);
    expect(isSafeCssColor('rgb(0,0,0);x:url(http://x)')).toBe(false);
  });

  it('rejects unknown names and empty values', () => {
    expect(isSafeCssColor('notacolor')).toBe(false);
    expect(isSafeCssColor('')).toBe(false);
    expect(isSafeCssColor('   ')).toBe(false);
  });
});
