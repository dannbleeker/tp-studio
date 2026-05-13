import { DIAGRAM_TYPE_LABEL, ENTITY_TYPE_META, defaultEntityType } from '@/domain/entityTypeMeta';
import { EXAMPLE_BY_DIAGRAM } from '@/domain/examples';
import type { DiagramType, EntityType } from '@/domain/types';
import { describe, expect, it } from 'vitest';

// One source of truth for the diagram-type keys covered by all of the
// per-DiagramType registries. Sourced from DIAGRAM_TYPE_LABEL because that
// map is the canonical `Record<DiagramType, _>` and TypeScript will flag a
// missing entry there first when a new diagram type lands.
const ALL_DIAGRAM_TYPES = Object.keys(DIAGRAM_TYPE_LABEL) as DiagramType[];

describe('defaultEntityType', () => {
  it('returns a sensible seed for every diagram type', () => {
    // Exhaustive over `ALL_DIAGRAM_TYPES` — adding a new diagram type without
    // a default would slip through if this were hard-coded.
    for (const type of ALL_DIAGRAM_TYPES) {
      const seed = defaultEntityType(type);
      expect(typeof seed).toBe('string');
      expect(seed.length).toBeGreaterThan(0);
    }
  });

  it('returns the documented seed for the current diagram types', () => {
    expect(defaultEntityType('crt')).toBe('effect');
    expect(defaultEntityType('frt')).toBe('effect');
    expect(defaultEntityType('prt')).toBe('intermediateObjective');
    expect(defaultEntityType('tt')).toBe('action');
  });
});

describe('ENTITY_TYPE_META (Block B / B3 icons)', () => {
  it('carries an icon for every entity type', () => {
    for (const type of Object.keys(ENTITY_TYPE_META) as EntityType[]) {
      const meta = ENTITY_TYPE_META[type];
      // Icons are Lucide components — renderable as JSX. They may surface as
      // plain function components or `forwardRef` exotic objects depending on
      // the lucide-react build; both are valid React element types, so we just
      // assert that the slot is present and non-nullish.
      expect(meta.icon).toBeTruthy();
      expect(['function', 'object']).toContain(typeof meta.icon);
    }
  });

  it('preserves the stripeColor / label / type triple alongside the icon', () => {
    for (const type of Object.keys(ENTITY_TYPE_META) as EntityType[]) {
      const meta = ENTITY_TYPE_META[type];
      expect(meta.type).toBe(type);
      expect(typeof meta.label).toBe('string');
      expect(meta.label.length).toBeGreaterThan(0);
      expect(typeof meta.stripeColor).toBe('string');
      expect(meta.stripeColor).toMatch(/^#/);
    }
  });
});

describe('EXAMPLE_BY_DIAGRAM', () => {
  it('has an example builder for every diagram type', () => {
    for (const type of ALL_DIAGRAM_TYPES) {
      expect(typeof EXAMPLE_BY_DIAGRAM[type]).toBe('function');
    }
  });

  it('produces a TPDocument whose diagramType matches its registry key', () => {
    for (const type of ALL_DIAGRAM_TYPES) {
      const doc = EXAMPLE_BY_DIAGRAM[type]();
      expect(doc.diagramType).toBe(type);
      expect(Object.keys(doc.entities).length).toBeGreaterThan(0);
    }
  });
});
