import { describe, expect, it } from 'vitest';
import { isStNodeFormat, ST_FACET_KEYS } from '@/domain/graph';
import { buildPatternSTReliableRapidResponse } from '@/domain/patterns/st-reliable-rapid-response';
import { buildPatternSTVendorManagedInventory } from '@/domain/patterns/st-vendor-managed-inventory';
import { buildPatternSTViableVisionScaffold } from '@/domain/patterns/st-viable-vision-scaffold';
import type { TPDocument } from '@/domain/types';
import { validate } from '@/domain/validators';

/**
 * Session 198 (backlog G) — the S&T template pack built on the corrected
 * directional-facet model (backlog B). Each pattern must be a valid, position-
 * clean facet-card tree so it opens without noise.
 */
const TEMPLATES = [
  { name: 'Reliable Rapid Response', build: buildPatternSTReliableRapidResponse },
  { name: 'Vendor-Managed Inventory', build: buildPatternSTVendorManagedInventory },
  { name: 'Viable Vision scaffold', build: buildPatternSTViableVisionScaffold },
];

const hasOutgoing = (doc: TPDocument, id: string): boolean =>
  Object.values(doc.edges).some((e) => e.sourceId === id);
const hasIncoming = (doc: TPDocument, id: string): boolean =>
  Object.values(doc.edges).some((e) => e.targetId === id);

describe('S&T facet template pack (backlog G, corrected model)', () => {
  for (const { name, build } of TEMPLATES) {
    describe(name, () => {
      it('builds an st doc where every step is a first-class facet card', () => {
        const doc = build();
        expect(doc.diagramType).toBe('st');
        const injections = Object.values(doc.entities).filter((e) => e.type === 'injection');
        expect(injections.length).toBeGreaterThanOrEqual(3);
        expect(injections.every((e) => isStNodeFormat(e))).toBe(true);
        for (const e of injections) {
          expect(e.attributes?.[ST_FACET_KEYS.strategy]).toBeDefined();
          expect(e.attributes?.[ST_FACET_KEYS.parallelAssumption]).toBeDefined();
        }
      });

      it('is position-clean: no open st-tactic-assumptions or st-tactic-fold-in warnings', () => {
        const open = validate(build()).filter((w) => !w.resolved);
        expect(open.some((w) => w.ruleId === 'st-tactic-assumptions')).toBe(false);
        expect(open.some((w) => w.ruleId === 'st-tactic-fold-in')).toBe(false);
      });

      it('pre-resolves the leaf rollup nudges so it opens clean', () => {
        const open = validate(build()).filter((w) => !w.resolved);
        expect(open.some((w) => w.ruleId === 'st-tactic-rollup')).toBe(false);
      });

      it('apex carries no necessary assumption; each leaf carries no sufficiency assumption', () => {
        const doc = build();
        const injections = Object.values(doc.entities).filter((e) => e.type === 'injection');
        const apex = injections.find((e) => !hasOutgoing(doc, e.id));
        expect(apex?.attributes?.[ST_FACET_KEYS.necessaryAssumption]).toBeUndefined();
        expect(apex?.attributes?.[ST_FACET_KEYS.sufficiencyAssumption]).toBeDefined();
        const leaves = injections.filter((e) => !hasIncoming(doc, e.id));
        expect(leaves.length).toBeGreaterThanOrEqual(2);
        for (const leaf of leaves) {
          expect(leaf.attributes?.[ST_FACET_KEYS.sufficiencyAssumption]).toBeUndefined();
          expect(leaf.attributes?.[ST_FACET_KEYS.necessaryAssumption]).toBeDefined();
        }
      });
    });
  }
});
