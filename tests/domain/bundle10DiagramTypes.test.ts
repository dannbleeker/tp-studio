import { DIAGRAM_TYPE_LABEL, PALETTE_BY_DIAGRAM, defaultEntityType } from '@/domain/entityTypeMeta';
import { EXAMPLE_BY_DIAGRAM } from '@/domain/examples';
import { createDocument } from '@/domain/factory';
import { isDiagramType } from '@/domain/guards';
import { HANDLE_ORIENTATION, LAYOUT_STRATEGY } from '@/domain/layoutStrategy';
import { METHOD_BY_DIAGRAM } from '@/domain/methodChecklist';
import { exportToJSON, importFromJSON } from '@/domain/persistence';
import { validate } from '@/domain/validators';
import { describe, expect, it } from 'vitest';

/**
 * Bundle 10 / FL-DT4 + FL-DT5 — two new diagram types. Both ride on top
 * of the existing entity model + layout pipeline + validator surface;
 * the "new diagram type" is mostly a thin shell (palette + label + method
 * checklist + initial doc). These tests lock in the contract — every
 * cross-cutting `Record<DiagramType, _>` map should carry an entry, and
 * the round-trip through JSON should preserve the new diagramType tag.
 */

describe('FL-DT4 — Strategy & Tactics Tree', () => {
  it('is recognized by isDiagramType', () => {
    expect(isDiagramType('st')).toBe(true);
  });

  it('has a human-readable label', () => {
    expect(DIAGRAM_TYPE_LABEL.st).toBe('Strategy & Tactics Tree');
  });

  it('palette surfaces S&T-relevant entity types', () => {
    const palette = PALETTE_BY_DIAGRAM.st;
    // Apex strategy (goal), tactic (injection), and the assumption-facet
    // carriers (necessaryCondition + assumption) are the load-bearing
    // types for the S&T pattern. Effects + notes round out the palette.
    expect(palette).toContain('goal');
    expect(palette).toContain('injection');
    expect(palette).toContain('necessaryCondition');
    expect(palette).toContain('assumption');
    expect(palette).toContain('note');
  });

  it('default entity type is injection (the tactic — "do something")', () => {
    expect(defaultEntityType('st')).toBe('injection');
  });

  it('uses auto-layout with vertical handles', () => {
    expect(LAYOUT_STRATEGY.st).toBe('auto');
    expect(HANDLE_ORIENTATION.st).toBe('vertical');
  });

  it('carries a method checklist with the six S&T steps', () => {
    const steps = METHOD_BY_DIAGRAM.st;
    expect(steps).toHaveLength(6);
    expect(steps.every((s) => s.id.startsWith('st.'))).toBe(true);
    // Spot-check the load-bearing step labels.
    const labels = steps.map((s) => s.label.toLowerCase());
    expect(labels.some((l) => l.includes('apex strategy'))).toBe(true);
    expect(labels.some((l) => l.includes('tactic'))).toBe(true);
    expect(labels.some((l) => l.includes('necessary'))).toBe(true);
    expect(labels.some((l) => l.includes('parallel'))).toBe(true);
    expect(labels.some((l) => l.includes('sufficiency'))).toBe(true);
  });

  it('createDocument produces a fresh empty S&T doc', () => {
    const doc = createDocument('st');
    expect(doc.diagramType).toBe('st');
    expect(Object.keys(doc.entities)).toHaveLength(0);
    expect(Object.keys(doc.edges)).toHaveLength(0);
    expect(doc.title).toMatch(/Strategy & Tactics Tree/);
  });

  it('JSON round-trip preserves the diagramType tag', () => {
    const doc = createDocument('st');
    const restored = importFromJSON(exportToJSON(doc));
    expect(restored.diagramType).toBe('st');
  });

  it('has an example builder that produces a non-empty doc', () => {
    const example = EXAMPLE_BY_DIAGRAM.st();
    expect(example.diagramType).toBe('st');
    expect(Object.keys(example.entities).length).toBeGreaterThan(0);
    expect(Object.keys(example.edges).length).toBeGreaterThan(0);
  });
});

describe('FL-DT5 — Freeform diagram', () => {
  it('is recognized by isDiagramType', () => {
    expect(isDiagramType('freeform')).toBe(true);
  });

  it('has a human-readable label', () => {
    expect(DIAGRAM_TYPE_LABEL.freeform).toBe('Freeform Diagram');
  });

  it('palette includes only neutral / annotation types', () => {
    const palette = PALETTE_BY_DIAGRAM.freeform;
    expect(palette).toContain('effect');
    expect(palette).toContain('assumption');
    expect(palette).toContain('note');
    // Crucially, no TOC-specific types in the default palette — the user
    // can add custom classes via the doc settings if they want their own
    // typology.
    expect(palette).not.toContain('ude');
    expect(palette).not.toContain('rootCause');
    expect(palette).not.toContain('injection');
    expect(palette).not.toContain('want');
  });

  it('default entity type is effect (neutral)', () => {
    expect(defaultEntityType('freeform')).toBe('effect');
  });

  it('has an empty method checklist on purpose', () => {
    expect(METHOD_BY_DIAGRAM.freeform).toEqual([]);
  });

  it('createDocument produces a fresh empty freeform doc', () => {
    const doc = createDocument('freeform');
    expect(doc.diagramType).toBe('freeform');
    expect(Object.keys(doc.entities)).toHaveLength(0);
  });

  it('JSON round-trip preserves the diagramType tag', () => {
    const doc = createDocument('freeform');
    const restored = importFromJSON(exportToJSON(doc));
    expect(restored.diagramType).toBe('freeform');
  });

  it('validators run cleanly on a fresh freeform doc (no type-specific CLR rules fire)', () => {
    const doc = createDocument('freeform');
    const warnings = validate(doc);
    // A fresh empty doc should have no warnings — the structural rules
    // need at least one entity to fire on.
    expect(warnings).toEqual([]);
  });

  it('example builder produces a doc whose warnings come only from structural rules', () => {
    const example = EXAMPLE_BY_DIAGRAM.freeform();
    const warnings = validate(example);
    // Structural rules might still fire (clarity, entity-existence) but
    // type-specific ones (cause-effect-reversal, predicted-effect-existence,
    // ec-missing-conflict, external-root-cause, complete-step,
    // additional-cause, cause-sufficiency) must not.
    const ruleIds = new Set(warnings.map((w) => w.ruleId));
    expect(ruleIds.has('cause-effect-reversal')).toBe(false);
    expect(ruleIds.has('predicted-effect-existence')).toBe(false);
    expect(ruleIds.has('ec-missing-conflict')).toBe(false);
    expect(ruleIds.has('external-root-cause')).toBe(false);
    expect(ruleIds.has('complete-step')).toBe(false);
    expect(ruleIds.has('additional-cause')).toBe(false);
    expect(ruleIds.has('cause-sufficiency')).toBe(false);
  });
});
