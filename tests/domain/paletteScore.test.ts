import { paletteScore } from '@/domain/paletteScore';
import { describe, expect, it } from 'vitest';

/**
 * Direct unit coverage for the palette's fuzzy scorer. Previously this
 * lived inline in `CommandPalette.tsx` and was only exercised indirectly
 * through palette-render tests; extracting it to its own module (Session
 * 39, #8 from the next-batch top-10) lets each scoring branch be pinned
 * deterministically — including the Session 37 fix that constrained the
 * subsequence-match branch to a single word.
 */

describe('paletteScore', () => {
  it('returns 0 for an empty query (match everything, no sort)', () => {
    expect(paletteScore('Export as JSON', '')).toBe(0);
  });

  it('scores 100 for an exact (case-insensitive) match', () => {
    expect(paletteScore('Undo', 'undo')).toBe(100);
    expect(paletteScore('Undo', 'UNDO')).toBe(100);
  });

  it('scores 80 for a prefix match', () => {
    expect(paletteScore('Export as JSON', 'expo')).toBe(80);
    expect(paletteScore('Export as JSON', 'Export')).toBe(80);
  });

  it('scores 50 for a substring (non-prefix) match', () => {
    expect(paletteScore('Show keyboard shortcuts', 'keyboard')).toBe(50);
    expect(paletteScore('Export as PNG (2×)', 'png')).toBe(50);
  });

  it('scores 20 for an in-word subsequence match', () => {
    // 'exrt' is a subsequence of 'export' — letters e, x, r, t appear in
    // order within the single word "Export".
    expect(paletteScore('Export as JSON', 'exrt')).toBe(20);
  });

  it('returns -1 for a cross-word subsequence (the Session 37 regression fix)', () => {
    // The letters e-x-p-o-r-t appear in order across "example" + "Evaporating"
    // but not within any single word. The Session 37 fix constrained the
    // subsequence-match branch to single-word matches; this pins it.
    expect(paletteScore('Load example Evaporating Cloud', 'export')).toBe(-1);
  });

  it('returns -1 when no branch matches', () => {
    expect(paletteScore('Undo', 'xyzqq')).toBe(-1);
  });

  it('handles labels with punctuation by treating non-alphanumeric runs as word breaks', () => {
    // The "as" word would match 'as' as a prefix; "PDF" wouldn't subseq-match
    // 'asd' alone. Tests that the split on `/[^a-z0-9]+/` covers `/`, space, `…`.
    expect(paletteScore('Print / Save as PDF…', 'pdf')).toBe(50);
    expect(paletteScore('Print / Save as PDF…', 'save')).toBe(50);
  });
});
