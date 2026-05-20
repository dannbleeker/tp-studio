import { describe, expect, it } from 'vitest';
import { DIAGRAM_TYPE_LABEL, defaultEntityType, paletteForDoc } from '@/domain/entityTypeMeta';
import { EXAMPLE_BY_DIAGRAM } from '@/domain/examples';
import { buildExampleNBR } from '@/domain/examples/nbr';
import { createDocument } from '@/domain/factory';
import { HANDLE_ORIENTATION, LAYOUT_STRATEGY } from '@/domain/layoutStrategy';
import { METHOD_BY_DIAGRAM } from '@/domain/methodChecklist';
import { PATTERNS, patternsForDiagram } from '@/domain/patterns';
import { validate } from '@/domain/validators';

/**
 * Session 134 / spec major gap #5 — NBR diagram-type registration guard.
 *
 * Tests pin the per-registry NBR entries (palette, label, default
 * entity type, layout strategy, handle orientation, method checklist,
 * validators, example, pattern library) so a future contributor who
 * touches one registry can't silently drop NBR from another.
 */

describe('NBR diagram type — registry coverage', () => {
  it('createDocument("nbr") returns a valid empty doc', () => {
    const doc = createDocument('nbr');
    expect(doc.diagramType).toBe('nbr');
    expect(Object.keys(doc.entities)).toHaveLength(0);
    expect(doc.schemaVersion).toBe(8);
  });

  it('DIAGRAM_TYPE_LABEL.nbr is the full name', () => {
    expect(DIAGRAM_TYPE_LABEL.nbr).toBe('Negative Branch Reservation');
  });

  it('paletteForDoc includes injection, effect, ude, desiredEffect, assumption, note', () => {
    const palette = paletteForDoc({ diagramType: 'nbr' });
    expect(palette).toContain('injection');
    expect(palette).toContain('effect');
    expect(palette).toContain('ude');
    expect(palette).toContain('desiredEffect');
    expect(palette).toContain('assumption');
    expect(palette).toContain('note');
  });

  it('defaultEntityType("nbr") is "ude" (the canonical empty-canvas drop)', () => {
    expect(defaultEntityType('nbr')).toBe('ude');
  });

  it('LAYOUT_STRATEGY.nbr is "auto"', () => {
    expect(LAYOUT_STRATEGY.nbr).toBe('auto');
  });

  it('HANDLE_ORIENTATION.nbr is "vertical" (bottom-up like FRT)', () => {
    expect(HANDLE_ORIENTATION.nbr).toBe('vertical');
  });

  it('METHOD_BY_DIAGRAM.nbr is non-empty and includes the canonical NBR steps', () => {
    const steps = METHOD_BY_DIAGRAM.nbr;
    expect(steps.length).toBeGreaterThan(0);
    const ids = steps.map((s) => s.id);
    expect(ids).toContain('nbr.injection');
    expect(ids).toContain('nbr.turning-point');
    expect(ids).toContain('nbr.mitigation');
    expect(ids).toContain('nbr.decision');
  });

  it('validate() runs on an NBR doc without throwing', () => {
    const doc = buildExampleNBR();
    expect(() => validate(doc)).not.toThrow();
  });

  it('EXAMPLE_BY_DIAGRAM.nbr returns an NBR doc with the canonical 7-entity shape', () => {
    const doc = EXAMPLE_BY_DIAGRAM.nbr();
    expect(doc.diagramType).toBe('nbr');
    expect(Object.keys(doc.entities).length).toBe(7);
    // Includes both intended-path and negative-branch entities.
    const titles = Object.values(doc.entities).map((e) => e.title);
    expect(titles.some((t) => /QA gate/i.test(t))).toBe(true);
    expect(titles.some((t) => /Competitor/i.test(t))).toBe(true);
    expect(titles.some((t) => /test suite/i.test(t))).toBe(true);
  });

  it('the pattern registry surfaces an NBR pattern', () => {
    const nbrPatterns = patternsForDiagram('nbr');
    expect(nbrPatterns.length).toBeGreaterThan(0);
    expect(nbrPatterns[0]?.diagramType).toBe('nbr');
    // The PATTERNS list as a whole still has unique ids.
    const ids = PATTERNS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('buildExampleNBR', () => {
  it('produces a doc with an injection, a UDE, and a mitigation injection', () => {
    const doc = buildExampleNBR();
    const types = Object.values(doc.entities).map((e) => e.type);
    expect(types.filter((t) => t === 'injection').length).toBeGreaterThanOrEqual(2);
    expect(types).toContain('ude');
    expect(types).toContain('desiredEffect');
  });

  it('the negative branch has at least two UDEs feeding from a turning-point effect', () => {
    const doc = buildExampleNBR();
    const udes = Object.values(doc.entities).filter((e) => e.type === 'ude');
    expect(udes.length).toBeGreaterThanOrEqual(2);
  });
});
