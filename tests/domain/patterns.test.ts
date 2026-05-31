import { describe, expect, it } from 'vitest';
import { PATTERNS, patternById, patternsForDiagram } from '@/domain/patterns';
import type { DiagramType } from '@/domain/types';

/**
 * Session 134 — pattern library registry guard.
 *
 * Pins the registry shape (every pattern builds; ids are unique; each
 * pattern's `build()` produces a doc whose `diagramType` matches the
 * registry entry) so future additions can't silently drift. Doesn't
 * test individual pattern contents — that's the `exampleEC` test's
 * job for the EC pattern, and growing per-pattern guards as patterns
 * accumulate would be brittle.
 */

describe('pattern registry', () => {
  it('has at least one pattern per built-in TOC diagram type (except freeform)', () => {
    // Freeform is intentionally skipped — a "freeform pattern" is an
    // oxymoron; users start a freeform doc from scratch. Other types
    // each have at least one curated pattern.
    const required: DiagramType[] = ['crt', 'frt', 'prt', 'tt', 'ec', 'goalTree', 'st'];
    for (const t of required) {
      const matched = patternsForDiagram(t);
      expect(matched.length, `expected at least one pattern for ${t}`).toBeGreaterThanOrEqual(1);
    }
  });

  it('has ≥5 patterns per non-freeform diagram type (Session 137 library expansion)', () => {
    // Session 137 — the curated pattern library reached the "5 per
    // type" milestone called out in `NEXT_STEPS.md`. Pinning the
    // floor here so a future removal that drops a type below 5 fires
    // red and the contributor has to either add a replacement or
    // make the call to lower the target deliberately. NBR included
    // even though the registry tests originally listed only the
    // seven primary types — the library now covers it too.
    const required: DiagramType[] = ['crt', 'frt', 'prt', 'tt', 'ec', 'goalTree', 'st', 'nbr'];
    for (const t of required) {
      const matched = patternsForDiagram(t);
      expect(
        matched.length,
        `expected ≥5 patterns for ${t}, got ${matched.length}`
      ).toBeGreaterThanOrEqual(5);
    }
  });

  it('uses unique stable ids', () => {
    const ids = PATTERNS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every pattern builds without throwing and emits the declared diagram type', () => {
    for (const pattern of PATTERNS) {
      let doc: ReturnType<typeof pattern.build> | null = null;
      expect(() => {
        doc = pattern.build();
      }, `pattern ${pattern.id} threw during build`).not.toThrow();
      // The non-null assertion is safe because the previous expect
      // would have failed if build threw.
      expect(
        doc!.diagramType,
        `pattern ${pattern.id} declared ${pattern.diagramType} but produced ${doc!.diagramType}`
      ).toBe(pattern.diagramType);
    }
  });

  it('every built doc has at least one entity and a non-empty title', () => {
    for (const pattern of PATTERNS) {
      const doc = pattern.build();
      expect(
        Object.keys(doc.entities).length,
        `pattern ${pattern.id} has no entities`
      ).toBeGreaterThan(0);
      expect(doc.title.trim().length, `pattern ${pattern.id} has an empty title`).toBeGreaterThan(
        0
      );
    }
  });

  it('every built doc carries the current schemaVersion (9)', () => {
    for (const pattern of PATTERNS) {
      const doc = pattern.build();
      expect(doc.schemaVersion, `pattern ${pattern.id} ships an outdated schemaVersion`).toBe(9);
    }
  });
});

describe('patternsForDiagram', () => {
  it('returns only patterns matching the given diagram type', () => {
    const crts = patternsForDiagram('crt');
    expect(crts.length).toBeGreaterThan(0);
    for (const p of crts) {
      expect(p.diagramType).toBe('crt');
    }
  });

  it('preserves registry order across the filtered subset', () => {
    const all = PATTERNS.map((p) => p.id);
    const crts = patternsForDiagram('crt');
    const crtIdsInRegistryOrder = all.filter((id) => crts.some((p) => p.id === id));
    expect(crts.map((p) => p.id)).toEqual(crtIdsInRegistryOrder);
  });
});

describe('patternById', () => {
  it('returns the pattern for a known id', () => {
    const p = patternById('crt-customer-satisfaction');
    expect(p).toBeDefined();
    expect(p?.diagramType).toBe('crt');
  });

  it('returns undefined for an unknown id', () => {
    expect(patternById('does-not-exist')).toBeUndefined();
  });
});

describe("goalTree-it-function (Dann's 2020 IT-function article)", () => {
  it('builds the 1 Goal · 2 CSFs · 6 NCs (8 necessity edges) + a boundary note', () => {
    const p = patternById('goalTree-it-function');
    expect(p).toBeDefined();
    const doc = p!.build();
    const entities = Object.values(doc.entities);
    const edges = Object.values(doc.edges);

    expect(entities).toHaveLength(10);
    expect(edges).toHaveLength(9);
    expect(entities.filter((e) => e.type === 'goal')).toHaveLength(1);
    expect(entities.filter((e) => e.type === 'criticalSuccessFactor')).toHaveLength(2);
    expect(entities.filter((e) => e.type === 'necessaryCondition')).toHaveLength(6);
    // The financial-restriction boundary rides as a non-causal note.
    expect(entities.filter((e) => e.type === 'note')).toHaveLength(1);
    // The 8 goal/CSF/NC links are necessity; the boundary note-edge is the 9th.
    expect(edges.filter((e) => e.kind === 'necessity')).toHaveLength(8);
    expect(doc.diagramType).toBe('goalTree');
  });
});

describe("ec-efrats-change-cloud (Efrat's generic change cloud)", () => {
  it('builds the canonical 5-box EC — 1 goal · 2 needs · 2 wants, with a D↔D′ mutex', () => {
    const p = patternById('ec-efrats-change-cloud');
    expect(p).toBeDefined();
    const doc = p!.build();
    const entities = Object.values(doc.entities);
    const edges = Object.values(doc.edges);

    expect(doc.diagramType).toBe('ec');
    expect(entities).toHaveLength(5);
    expect(entities.filter((e) => e.type === 'goal')).toHaveLength(1);
    expect(entities.filter((e) => e.type === 'need')).toHaveLength(2);
    expect(entities.filter((e) => e.type === 'want')).toHaveLength(2);
    // Every box is slotted (a / b / c / d / dPrime) for the hand-positioned layout.
    expect(entities.every((e) => e.ecSlot)).toBe(true);
    // Four necessity links (D→B, D′→C, B→A, C→A) plus exactly one mutex (D↔D′).
    expect(edges.filter((e) => e.kind === 'necessity')).toHaveLength(4);
    expect(edges.filter((e) => e.isMutualExclusion)).toHaveLength(1);
  });
});
