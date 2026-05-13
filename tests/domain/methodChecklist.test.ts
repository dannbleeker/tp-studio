import { DIAGRAM_TYPE_LABEL } from '@/domain/entityTypeMeta';
import { ALL_METHOD_STEP_IDS, METHOD_BY_DIAGRAM } from '@/domain/methodChecklist';
import type { DiagramType } from '@/domain/types';
import { describe, expect, it } from 'vitest';

const ALL_DIAGRAM_TYPES = Object.keys(DIAGRAM_TYPE_LABEL) as DiagramType[];

// FL-DT5 (freeform) intentionally has no canonical recipe — the Document
// Inspector simply hides the checklist section when the array is empty.
// The other diagram types still need at least one step.
const DIAGRAM_TYPES_WITH_CHECKLIST = ALL_DIAGRAM_TYPES.filter((t) => t !== 'freeform');

describe('METHOD_BY_DIAGRAM catalog', () => {
  it('has at least one step for every TOC diagram type', () => {
    for (const type of DIAGRAM_TYPES_WITH_CHECKLIST) {
      expect(METHOD_BY_DIAGRAM[type].length).toBeGreaterThan(0);
    }
  });

  it('intentionally has no steps for freeform diagrams', () => {
    expect(METHOD_BY_DIAGRAM.freeform).toEqual([]);
  });

  it('every step has a non-empty id and label', () => {
    for (const type of ALL_DIAGRAM_TYPES) {
      for (const step of METHOD_BY_DIAGRAM[type]) {
        expect(typeof step.id).toBe('string');
        expect(step.id.length).toBeGreaterThan(0);
        expect(typeof step.label).toBe('string');
        expect(step.label.length).toBeGreaterThan(0);
      }
    }
  });

  it('every step id is prefixed by its diagram type', () => {
    // `crt.scope` lives in METHOD_BY_DIAGRAM.crt, etc. Prevents accidental
    // collisions when a doc switches diagram type.
    for (const type of ALL_DIAGRAM_TYPES) {
      const prefix = `${type}.`;
      for (const step of METHOD_BY_DIAGRAM[type]) {
        expect(step.id.startsWith(prefix)).toBe(true);
      }
    }
  });

  it('has no duplicate step ids globally', () => {
    const seen = new Set<string>();
    for (const type of ALL_DIAGRAM_TYPES) {
      for (const step of METHOD_BY_DIAGRAM[type]) {
        expect(seen.has(step.id)).toBe(false);
        seen.add(step.id);
      }
    }
  });

  it('ALL_METHOD_STEP_IDS contains every id from every diagram', () => {
    for (const type of ALL_DIAGRAM_TYPES) {
      for (const step of METHOD_BY_DIAGRAM[type]) {
        expect(ALL_METHOD_STEP_IDS.has(step.id)).toBe(true);
      }
    }
  });
});
