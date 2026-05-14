import { exportToJSON, importFromJSON } from '@/domain/persistence';
import { TEMPLATE_SPECS, buildTemplate, loadTemplate } from '@/templates';
import { templateThumbnailSvg } from '@/templates/thumbnail';
import { describe, expect, it } from 'vitest';

/**
 * Session 79 / brief §12 — Templates library smoke tests.
 *
 * Verifies that:
 *   1. The library carries the brief's 10 curated templates.
 *   2. Every spec inflates into a valid `TPDocument` (schemaVersion
 *      7, well-formed entities + edges, valid annotation numbers).
 *   3. Each template round-trips through JSON without loss.
 *   4. EC templates pre-position the 5 canonical slots with ecSlot
 *      bindings.
 *   5. The thumbnail SVG generator produces well-formed SVG.
 */

describe('TEMPLATE_SPECS registry', () => {
  it('carries 10 curated templates per brief §12', () => {
    expect(TEMPLATE_SPECS).toHaveLength(10);
  });

  it('every spec has a unique slug id', () => {
    const ids = TEMPLATE_SPECS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes 2 Goal Trees + 5 ECs + 3 CRTs', () => {
    const counts = TEMPLATE_SPECS.reduce<Record<string, number>>((acc, t) => {
      acc[t.diagramType] = (acc[t.diagramType] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts.goalTree).toBe(2);
    expect(counts.ec).toBe(5);
    expect(counts.crt).toBe(3);
  });

  it('every spec has a title + description', () => {
    for (const spec of TEMPLATE_SPECS) {
      expect(spec.title.length).toBeGreaterThan(0);
      expect(spec.description.length).toBeGreaterThan(20);
    }
  });
});

describe('buildTemplate', () => {
  for (const spec of TEMPLATE_SPECS) {
    it(`inflates ${spec.id} into a valid Document`, () => {
      const doc = buildTemplate(spec);
      expect(doc.diagramType).toBe(spec.diagramType);
      expect(doc.schemaVersion).toBe(7);
      expect(Object.keys(doc.entities)).toHaveLength(spec.entities.length);
      expect(Object.keys(doc.edges)).toHaveLength(spec.edges.length);
      // Annotation numbers should be 1..N exactly.
      const numbers = Object.values(doc.entities)
        .map((e) => e.annotationNumber)
        .sort((a, b) => a - b);
      expect(numbers).toEqual(spec.entities.map((_, i) => i + 1));
    });

    it(`${spec.id} round-trips through JSON without loss`, () => {
      const doc = buildTemplate(spec);
      const restored = importFromJSON(exportToJSON(doc));
      expect(restored.diagramType).toBe(doc.diagramType);
      expect(Object.keys(restored.entities).sort()).toEqual(Object.keys(doc.entities).sort());
      expect(Object.keys(restored.edges).sort()).toEqual(Object.keys(doc.edges).sort());
    });
  }
});

describe('EC templates', () => {
  it('every EC spec pre-positions all 5 canonical slots', () => {
    const ecSpecs = TEMPLATE_SPECS.filter((t) => t.diagramType === 'ec');
    for (const spec of ecSpecs) {
      const slots = new Set(spec.entities.map((e) => e.ecSlot).filter(Boolean));
      expect(slots).toEqual(new Set(['a', 'b', 'c', 'd', 'dPrime']));
    }
  });

  it('every EC spec includes a mutex edge between D and D′', () => {
    const ecSpecs = TEMPLATE_SPECS.filter((t) => t.diagramType === 'ec');
    for (const spec of ecSpecs) {
      const d = spec.entities.find((e) => e.ecSlot === 'd');
      const dp = spec.entities.find((e) => e.ecSlot === 'dPrime');
      expect(d).toBeDefined();
      expect(dp).toBeDefined();
      const mutex = spec.edges.find(
        (e) =>
          e.isMutualExclusion === true &&
          ((e.source === d!.key && e.target === dp!.key) ||
            (e.source === dp!.key && e.target === d!.key))
      );
      expect(mutex).toBeDefined();
    }
  });

  it('EC edges default to necessity-kind on inflate', () => {
    const spec = TEMPLATE_SPECS.find((t) => t.diagramType === 'ec');
    if (!spec) throw new Error('no EC spec');
    const doc = buildTemplate(spec);
    const kinds = new Set(Object.values(doc.edges).map((e) => e.kind));
    expect(kinds.has('necessity')).toBe(true);
  });
});

describe('Goal Tree templates', () => {
  it('every Goal Tree has exactly one apex `goal` entity', () => {
    const goalTrees = TEMPLATE_SPECS.filter((t) => t.diagramType === 'goalTree');
    for (const spec of goalTrees) {
      const goalCount = spec.entities.filter((e) => e.type === 'goal').length;
      expect(goalCount).toBe(1);
    }
  });

  it('every Goal Tree edge inflates to necessity-kind', () => {
    const goalTrees = TEMPLATE_SPECS.filter((t) => t.diagramType === 'goalTree');
    for (const spec of goalTrees) {
      const doc = buildTemplate(spec);
      for (const edge of Object.values(doc.edges)) {
        expect(edge.kind).toBe('necessity');
      }
    }
  });
});

describe('loadTemplate (id lookup)', () => {
  it('inflates a known template by id', () => {
    const doc = loadTemplate('generic-saas-goal-tree');
    expect(doc).not.toBeNull();
    expect(doc?.diagramType).toBe('goalTree');
  });

  it('returns null for unknown id', () => {
    expect(loadTemplate('does-not-exist')).toBeNull();
  });
});

describe('templateThumbnailSvg', () => {
  for (const spec of TEMPLATE_SPECS) {
    it(`renders SVG for ${spec.id}`, () => {
      const svg = templateThumbnailSvg(spec);
      expect(svg).toContain('<svg');
      expect(svg).toContain('viewBox');
      // Sanity: SVG includes at least one entity rectangle.
      expect(svg).toContain('<rect');
    });
  }
});
