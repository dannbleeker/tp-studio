import { EC_SLOT_GUIDING_QUESTIONS, EC_SLOT_LABEL } from '@/domain/ecGuiding';
import { describe, expect, it } from 'vitest';

/**
 * Session 87 / EC PPT comparison item #2 — Per-slot guiding questions.
 *
 * Pure-data module; the tests guard:
 *   - The full canonical set of five slots is present.
 *   - Each slot's question matches the BESTSELLER PPT wording.
 *   - The slot label uses the PPT's letter convention (D′ with the
 *     prime mark).
 */

describe('EC guiding-question table', () => {
  it('covers all five canonical EC slots', () => {
    expect(Object.keys(EC_SLOT_GUIDING_QUESTIONS).sort()).toEqual(
      ['a', 'b', 'c', 'd', 'dPrime'].sort()
    );
    expect(Object.keys(EC_SLOT_LABEL).sort()).toEqual(['a', 'b', 'c', 'd', 'dPrime'].sort());
  });

  it('A asks about the common objective satisfying B and C', () => {
    expect(EC_SLOT_GUIDING_QUESTIONS.a).toMatch(/common objective/i);
    expect(EC_SLOT_GUIDING_QUESTIONS.a).toMatch(/both need B and need C/);
  });

  it("B and C each frame as 'what need is satisfied'", () => {
    expect(EC_SLOT_GUIDING_QUESTIONS.b).toMatch(/what need is satisfied/i);
    expect(EC_SLOT_GUIDING_QUESTIONS.c).toMatch(/what need is satisfied/i);
  });

  it("D and D′ each frame as 'what action'", () => {
    expect(EC_SLOT_GUIDING_QUESTIONS.d).toMatch(/what action/i);
    expect(EC_SLOT_GUIDING_QUESTIONS.dPrime).toMatch(/what is the action I want/i);
  });

  it('D′ label uses the prime mark', () => {
    expect(EC_SLOT_LABEL.dPrime).toContain('′');
  });

  it('every question is a non-empty string ending with a question mark', () => {
    for (const q of Object.values(EC_SLOT_GUIDING_QUESTIONS)) {
      expect(q.length).toBeGreaterThan(0);
      expect(q.trim().endsWith('?')).toBe(true);
    }
  });
});
