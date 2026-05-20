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

  it('every built doc carries the current schemaVersion (8)', () => {
    for (const pattern of PATTERNS) {
      const doc = pattern.build();
      expect(doc.schemaVersion, `pattern ${pattern.id} ships an outdated schemaVersion`).toBe(8);
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
