import { describe, expect, it } from 'vitest';
import { DIAGRAM_TYPE_LABEL, defaultEntityType, paletteForDoc } from '@/domain/entityTypeMeta';
import { EXAMPLE_BY_DIAGRAM } from '@/domain/examples';
import { buildExampleID } from '@/domain/examples/id';
import { createDocument } from '@/domain/factory';
import { FORCE_RADIAL, HANDLE_ORIENTATION, LAYOUT_STRATEGY } from '@/domain/layoutStrategy';
import { METHOD_BY_DIAGRAM } from '@/domain/methodChecklist';
import { PATTERNS, patternsForDiagram } from '@/domain/patterns';
import { validate } from '@/domain/validators';

/**
 * Interference Diagram — diagram-type registration guard. Pins the per-registry
 * ID entries (palette, label, default entity type, layout, method checklist,
 * validators, example, pattern library) so a future contributor who touches one
 * registry can't silently drop ID from another (the NBR-drop lesson).
 */

describe('ID diagram type — registry coverage', () => {
  it('createDocument("id") seeds a single central objective', () => {
    const doc = createDocument('id');
    expect(doc.diagramType).toBe('id');
    const entities = Object.values(doc.entities);
    expect(entities).toHaveLength(1);
    expect(entities[0]?.type).toBe('goal');
    expect(doc.schemaVersion).toBe(10);
  });

  it('DIAGRAM_TYPE_LABEL.id is the full name', () => {
    expect(DIAGRAM_TYPE_LABEL.id).toBe('Interference Diagram');
  });

  it('paletteForDoc includes obstacle, intermediateObjective, goal, note (the ID triple + notes)', () => {
    const palette = paletteForDoc({ diagramType: 'id' });
    expect(palette).toContain('obstacle');
    expect(palette).toContain('intermediateObjective');
    expect(palette).toContain('goal');
    expect(palette).toContain('note');
    expect(palette).not.toContain('assumption');
  });

  it('defaultEntityType("id") is "obstacle" (add another interference)', () => {
    expect(defaultEntityType('id')).toBe('obstacle');
  });

  it('forces the radial layout (FORCE_RADIAL.id), auto strategy', () => {
    expect(LAYOUT_STRATEGY.id).toBe('auto');
    expect(FORCE_RADIAL.id).toBe(true);
    expect(HANDLE_ORIENTATION.id).toBe('vertical');
  });

  it('METHOD_BY_DIAGRAM.id is non-empty and includes the canonical ID steps', () => {
    const ids = METHOD_BY_DIAGRAM.id.map((s) => s.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids).toContain('id.objective');
    expect(ids).toContain('id.interferences');
    expect(ids).toContain('id.injections');
  });

  it('validate() runs on an ID doc without throwing (no causal false-fires)', () => {
    const doc = buildExampleID();
    expect(() => validate(doc)).not.toThrow();
  });

  it('EXAMPLE_BY_DIAGRAM.id returns a hub-and-spoke ID (objective + interferences + fixes)', () => {
    const doc = EXAMPLE_BY_DIAGRAM.id();
    expect(doc.diagramType).toBe('id');
    const types = Object.values(doc.entities).map((e) => e.type);
    expect(types.filter((t) => t === 'goal')).toHaveLength(1);
    expect(types.filter((t) => t === 'obstacle').length).toBeGreaterThan(0);
    expect(types).toContain('intermediateObjective');
  });

  it('the pattern registry surfaces both ID modes', () => {
    const idPatterns = patternsForDiagram('id');
    expect(idPatterns.map((p) => p.id).sort()).toEqual([
      'id-constraint-exploitation',
      'id-strategy',
    ]);
    // Global pattern ids stay unique.
    const ids = PATTERNS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
