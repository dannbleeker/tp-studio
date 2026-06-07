import { describe, expect, it } from 'vitest';
import { findCycles } from '@/domain/graph';
import { loopsWithPolarity } from '@/domain/loopAnalysis';
import { buildPatternCRTErodingGoals } from '@/domain/patterns/crt-eroding-goals';
import { buildPatternCRTEscalation } from '@/domain/patterns/crt-escalation';
import { buildPatternCRTFixesThatFail } from '@/domain/patterns/crt-fixes-that-fail';
import { buildPatternCRTShiftingTheBurden } from '@/domain/patterns/crt-shifting-the-burden';
import { buildPatternFRTLimitsToGrowth } from '@/domain/patterns/frt-limits-to-growth';

/**
 * Session 179 (E1) — system-archetype patterns. Each archetype IS a feedback
 * loop whose polarity is its defining dynamic (a reinforcing vicious/virtuous
 * cycle, or a balancing limit). Pin that here so a future edit can't silently
 * flip R↔B, drop the loop, or lose the back-edge arc — the pedagogy of the
 * pattern lives in those facts. (The generic shape/registry contract is already
 * covered by `patterns.test.ts`.)
 */
const CASES = [
  { name: 'Fixes that Fail', build: buildPatternCRTFixesThatFail, type: 'crt', polarity: 'reinforcing' },
  { name: 'Escalation', build: buildPatternCRTEscalation, type: 'crt', polarity: 'reinforcing' },
  {
    name: 'Shifting the Burden',
    build: buildPatternCRTShiftingTheBurden,
    type: 'crt',
    polarity: 'reinforcing',
  },
  { name: 'Eroding Goals', build: buildPatternCRTErodingGoals, type: 'crt', polarity: 'reinforcing' },
  {
    name: 'Limits to Growth',
    build: buildPatternFRTLimitsToGrowth,
    type: 'frt',
    polarity: 'balancing',
  },
] as const;

describe('system-archetype patterns', () => {
  for (const c of CASES) {
    describe(c.name, () => {
      it('builds the expected diagram type with entities and exactly one closed loop', () => {
        const doc = c.build();
        expect(doc.diagramType).toBe(c.type);
        expect(Object.keys(doc.entities).length).toBeGreaterThanOrEqual(3);
        expect(findCycles(doc)).toHaveLength(1);
      });

      it(`reads as a ${c.polarity} loop`, () => {
        const loops = loopsWithPolarity(c.build());
        expect(loops).toHaveLength(1);
        expect(loops[0]?.polarity).toBe(c.polarity);
      });

      it('nominates exactly one back-edge arc to close the loop', () => {
        const doc = c.build();
        expect(Object.values(doc.edges).filter((e) => e.isBackEdge === true)).toHaveLength(1);
      });
    });
  }
});
