import { describe, expect, it } from 'vitest';
import { importFromJSON } from '@/domain/persistence';

/**
 * Phase 3 #8 (TT richness) — per-step `need` + `workingAssumption` on action
 * entities. Optional free text, validated like the other entity strings:
 * round-trips when set, omitted when empty/absent, rejected when non-string.
 */

const docJSON = (extra: Record<string, unknown>): string =>
  JSON.stringify({
    schemaVersion: 9,
    id: 'd',
    diagramType: 'tt',
    title: 'd',
    nextAnnotationNumber: 2,
    entities: {
      a1: {
        id: 'a1',
        type: 'action',
        title: 'Do X',
        annotationNumber: 1,
        createdAt: 1,
        updatedAt: 1,
        ...extra,
      },
    },
    edges: {},
    groups: {},
    resolvedWarnings: {},
    createdAt: 1,
    updatedAt: 1,
  });

describe('TT per-step Need + Working Assumption — persistence', () => {
  it('round-trips both fields', () => {
    const doc = importFromJSON(
      docJSON({ need: 'Protect quality', workingAssumption: 'The reviewer is available' })
    );
    expect(doc.entities.a1?.need).toBe('Protect quality');
    expect(doc.entities.a1?.workingAssumption).toBe('The reviewer is available');
  });

  it('omits empty or absent fields', () => {
    const doc = importFromJSON(docJSON({ need: '', workingAssumption: '' }));
    expect(doc.entities.a1?.need).toBeUndefined();
    expect(doc.entities.a1?.workingAssumption).toBeUndefined();
    expect(importFromJSON(docJSON({})).entities.a1?.need).toBeUndefined();
  });

  it('rejects non-string values', () => {
    expect(() => importFromJSON(docJSON({ need: 5 }))).toThrow();
    expect(() => importFromJSON(docJSON({ workingAssumption: {} }))).toThrow();
  });
});
