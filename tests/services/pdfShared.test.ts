import { describe, expect, it } from 'vitest';
import { hasNonLatin1 } from '@/services/exporters/pdfShared';

/**
 * Session 193 — the Latin-1 guard the Print/Save-as-PDF dialog and the EC
 * workshop export use to warn before jsPDF's built-in fonts silently drop
 * glyphs they can't draw.
 */
describe('hasNonLatin1', () => {
  it('is false for pure ASCII', () => {
    expect(hasNonLatin1('Reduce lead time by 30%')).toBe(false);
    expect(hasNonLatin1('')).toBe(false);
  });

  it('is false for Latin-1 supplement characters (≤ 0xFF)', () => {
    // Accented Western-European letters, middle dot, ± all live in Latin-1.
    expect(hasNonLatin1('Naïve café résumé · ±5%')).toBe(false);
    expect(hasNonLatin1('ÿ')).toBe(false); // ÿ — the top of the range
  });

  it('is true when any character exceeds Latin-1', () => {
    expect(hasNonLatin1('Цель')).toBe(true); // Cyrillic
    expect(hasNonLatin1('目標')).toBe(true); // CJK
    expect(hasNonLatin1('mostly ascii… then an em‑dash')).toBe(true); // U+2026 / U+2011
    expect(hasNonLatin1('Ā')).toBe(true); // Ā — one past the range
  });

  it('detects astral-plane characters (surrogate pairs)', () => {
    expect(hasNonLatin1('ship it 🚀')).toBe(true);
  });
});
