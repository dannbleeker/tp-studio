import { DIAGRAM_TYPE_LABEL } from '@/domain/entityTypeMeta';
import { INITIAL_DOC_BY_DIAGRAM, createDocument } from '@/domain/factory';
import type { DiagramType } from '@/domain/types';
import { describe, expect, it } from 'vitest';

const ALL_DIAGRAM_TYPES = Object.keys(DIAGRAM_TYPE_LABEL) as DiagramType[];

describe('createDocument', () => {
  it.each(ALL_DIAGRAM_TYPES)('produces a valid blank document for %s', (type) => {
    const doc = createDocument(type);
    expect(doc.diagramType).toBe(type);
    expect(doc.schemaVersion).toBe(7);
    expect(doc.title).toMatch(/Untitled/);
    expect(doc.createdAt).toBeTypeOf('number');
    expect(doc.updatedAt).toBe(doc.createdAt);
    expect(doc.resolvedWarnings).toEqual({});
    expect(doc.groups).toEqual({});
  });

  it.each(ALL_DIAGRAM_TYPES.filter((t) => t !== 'ec'))(
    '%s starts blank (no seeded entities / edges)',
    (type) => {
      const doc = createDocument(type);
      expect(doc.entities).toEqual({});
      expect(doc.edges).toEqual({});
      expect(doc.nextAnnotationNumber).toBe(1);
    }
  );

  it('EC starts pre-seeded with the 5 boxes at canonical positions and the 4 sufficiency edges', () => {
    // Evaporating Cloud is the first diagram with a non-empty seed — the
    // 5-box geometry IS the diagnostic, so a blank canvas would erase the
    // method. The seed mirrors the canonical A / B / C / D / D' layout.
    const doc = createDocument('ec');
    const entities = Object.values(doc.entities);
    expect(entities).toHaveLength(5);
    // Types: one goal, two needs, two wants.
    const byType = entities.reduce<Record<string, number>>((acc, e) => {
      acc[e.type] = (acc[e.type] ?? 0) + 1;
      return acc;
    }, {});
    expect(byType).toEqual({ goal: 1, need: 2, want: 2 });
    // Every seeded entity has a position; the goal sits left of the needs,
    // and the needs sit left of the wants — the canonical EC reading order.
    for (const e of entities) expect(e.position).toBeDefined();
    const goal = entities.find((e) => e.type === 'goal');
    const needs = entities.filter((e) => e.type === 'need');
    const wants = entities.filter((e) => e.type === 'want');
    expect(goal?.position?.x).toBeLessThan(needs[0]?.position?.x ?? 0);
    expect(needs[0]?.position?.x).toBeLessThan(wants[0]?.position?.x ?? 0);
    // Four sufficiency edges wire D→B, D'→C, B→A, C→A.
    expect(Object.keys(doc.edges)).toHaveLength(4);
    expect(doc.nextAnnotationNumber).toBe(6);
  });
});

describe('INITIAL_DOC_BY_DIAGRAM', () => {
  it('has a seed function for every diagram type', () => {
    for (const type of ALL_DIAGRAM_TYPES) {
      expect(typeof INITIAL_DOC_BY_DIAGRAM[type]).toBe('function');
    }
  });
});
