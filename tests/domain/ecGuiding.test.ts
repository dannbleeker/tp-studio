import { describe, expect, it } from 'vitest';
import { EC_STEPS_BY_CLOUD_TYPE } from '@/components/canvas/wizards/creationWizardSteps';
import { CLOUD_TYPES } from '@/domain/cloudType';
import {
  ALL_EC_SLOTS,
  EC_CLOUD_TYPE_BREAK_HINT,
  EC_CLOUD_TYPE_ORDER,
  EC_SLOT_GUIDING_QUESTIONS,
  EC_SLOT_LABEL,
  EC_SLOTS_BY_ORDER,
} from '@/domain/ecGuiding';

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

/**
 * Session 197 (backlog D1) — cloud-type-aware EC wizard spec. Pins the shape of
 * the per-type build orders, prompts, and break hints so a future edit can't
 * leave a cloud type half-specified.
 */
describe('EC cloud-type wizard spec (D1)', () => {
  it('every cloud type has a build order that is a permutation of the five slots', () => {
    for (const t of CLOUD_TYPES) {
      const order = EC_CLOUD_TYPE_ORDER[t];
      expect(order, t).toHaveLength(5);
      expect([...order].sort(), t).toEqual([...ALL_EC_SLOTS].sort());
    }
  });

  it('every cloud type has a prompt + placeholder for each of its five slots', () => {
    for (const t of CLOUD_TYPES) {
      for (const slot of ALL_EC_SLOTS) {
        const step = EC_STEPS_BY_CLOUD_TYPE[t][slot];
        expect(step?.prompt.trim().length, `${t}.${slot} prompt`).toBeGreaterThan(0);
        expect(step?.placeholder.trim().length, `${t}.${slot} placeholder`).toBeGreaterThan(0);
      }
    }
  });

  it('every cloud type has a non-empty break hint', () => {
    for (const t of CLOUD_TYPES) {
      expect(EC_CLOUD_TYPE_BREAK_HINT[t].trim().length, t).toBeGreaterThan(0);
    }
  });

  it('shared orders reuse the generic walks; firefighting/ude carry their own', () => {
    expect(EC_CLOUD_TYPE_ORDER.dilemma).toEqual(EC_SLOTS_BY_ORDER.dFirst);
    expect(EC_CLOUD_TYPE_ORDER.conflict).toEqual(EC_SLOTS_BY_ORDER.dFirst);
    expect(EC_CLOUD_TYPE_ORDER.consolidated).toEqual(EC_SLOTS_BY_ORDER.aFirst);
    expect(EC_CLOUD_TYPE_ORDER.core).toEqual(EC_SLOTS_BY_ORDER.aFirst);
    expect(EC_CLOUD_TYPE_ORDER.firefighting).toEqual(['b', 'd', 'dPrime', 'c', 'a']);
    expect(EC_CLOUD_TYPE_ORDER.ude).toEqual(['b', 'd', 'c', 'dPrime', 'a']);
  });
});
