import { describe, expect, it } from 'vitest';
import {
  applyMigrations,
  CURRENT_SCHEMA_VERSION,
  type Migration,
  migrateToCurrent,
} from '@/domain/migrations';

describe('migrateToCurrent', () => {
  it('returns a CURRENT_SCHEMA_VERSION document untouched in shape', () => {
    const doc = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      foo: 'bar',
      entities: {},
      nextAnnotationNumber: 1,
    };
    expect(migrateToCurrent(doc)).toEqual(doc);
  });

  it('migrates a v1 document forward to current, assigning annotation numbers', () => {
    const v1Doc = {
      schemaVersion: 1,
      entities: {
        a: { id: 'a', type: 'effect', title: 'A', createdAt: 1, updatedAt: 1 },
        b: { id: 'b', type: 'effect', title: 'B', createdAt: 2, updatedAt: 2 },
      },
    };
    const result = migrateToCurrent(v1Doc) as {
      schemaVersion: number;
      entities: Record<string, { annotationNumber: number }>;
      nextAnnotationNumber: number;
    };
    expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    // Sorted by createdAt asc, then id asc — so `a` gets 1, `b` gets 2.
    expect(result.entities.a!.annotationNumber).toBe(1);
    expect(result.entities.b!.annotationNumber).toBe(2);
    expect(result.nextAnnotationNumber).toBe(3);
  });

  it('migrates a v2 document forward to current, adding an empty groups map', () => {
    const v2Doc = {
      schemaVersion: 2,
      entities: { a: { id: 'a', type: 'effect', title: 'A', annotationNumber: 1 } },
      nextAnnotationNumber: 2,
    };
    const result = migrateToCurrent(v2Doc) as { schemaVersion: number; groups: unknown };
    expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.groups).toEqual({});
  });

  it('migrates a v3 document forward to current, leaving groups untouched', () => {
    const v3Doc = {
      schemaVersion: 3,
      entities: {},
      groups: {
        G1: {
          id: 'G1',
          title: 'Existing',
          color: 'amber',
          memberIds: [],
          collapsed: false,
          createdAt: 1,
          updatedAt: 1,
        },
      },
      nextAnnotationNumber: 1,
    };
    const result = migrateToCurrent(v3Doc) as { schemaVersion: number; groups: unknown };
    expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.groups).toEqual(v3Doc.groups);
  });

  it('mints an Assumption record only for assumption-entities attached to an edge (L4)', () => {
    const v6Doc = {
      schemaVersion: 6,
      diagramType: 'crt',
      entities: {
        cause: {
          id: 'cause',
          type: 'effect',
          title: 'Cause',
          annotationNumber: 1,
          createdAt: 1,
          updatedAt: 1,
        },
        effect: {
          id: 'effect',
          type: 'effect',
          title: 'Effect',
          annotationNumber: 2,
          createdAt: 1,
          updatedAt: 1,
        },
        asmAttached: {
          id: 'asmAttached',
          type: 'assumption',
          title: 'Attached',
          annotationNumber: 3,
          createdAt: 1,
          updatedAt: 1,
        },
        asmOrphan: {
          id: 'asmOrphan',
          type: 'assumption',
          title: 'Orphan',
          annotationNumber: 4,
          createdAt: 1,
          updatedAt: 1,
        },
      },
      edges: {
        e1: { id: 'e1', sourceId: 'cause', targetId: 'effect', assumptionIds: ['asmAttached'] },
      },
      groups: {},
      nextAnnotationNumber: 5,
    };
    const result = migrateToCurrent(v6Doc) as { assumptions: Record<string, { edgeId: string }> };
    // The attached assumption-entity mints a record pointing at its edge…
    expect(result.assumptions.asmAttached).toBeDefined();
    expect(result.assumptions.asmAttached!.edgeId).toBe('e1');
    // …but an orphaned assumption-entity (referenced by no edge) does NOT mint
    // a dangling record with edgeId='' that could never resolve to an edge.
    expect(result.assumptions.asmOrphan).toBeUndefined();
  });

  it('rejects a document with a schemaVersion newer than the app supports', () => {
    expect(() => migrateToCurrent({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 })).toThrow(
      /newer than this app supports/
    );
  });

  // Session 87 / EC PPT comparison item #4 — v7→v8 migration for the
  // additive `ecVerbalStyle` field. Purely a schema-version bump; no
  // existing data shape changes, so v7 docs without the field stay
  // unchanged but stamp at v8 on the way out.
  it('migrates a v7 document forward to v8 without changing any other field', () => {
    const v7Doc = {
      schemaVersion: 7,
      diagramType: 'ec',
      entities: { a: { id: 'a', type: 'goal', title: 'A', annotationNumber: 1, ecSlot: 'a' } },
      edges: {},
      groups: {},
      nextAnnotationNumber: 2,
    };
    const result = migrateToCurrent(v7Doc) as {
      schemaVersion: number;
      ecVerbalStyle?: string;
      entities: Record<string, unknown>;
    };
    expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    // Field stays undefined (verbalisation layer interprets as 'neutral').
    expect(result.ecVerbalStyle).toBeUndefined();
    // Everything else round-trips untouched.
    expect(result.entities).toEqual(v7Doc.entities);
  });
});

describe('applyMigrations', () => {
  // Fixture migrations let us exercise the loop without touching the real registry.
  const v0ToV1: Migration = {
    fromVersion: 0,
    toVersion: 1,
    description: 'fixture: add schemaVersion field',
    migrate: (doc) => ({ ...(doc as object), schemaVersion: 1 }),
  };
  const v1ToV2: Migration = {
    fromVersion: 1,
    toVersion: 2,
    description: 'fixture: add example field',
    migrate: (doc) => ({ ...(doc as object), schemaVersion: 2, example: 'added' }),
  };

  it('walks a v0 document forward to v2 through both migrations', () => {
    const out = applyMigrations({}, [v0ToV1, v1ToV2], 2);
    expect(out).toEqual({ schemaVersion: 2, example: 'added' });
  });

  it('stops at the target version even if more migrations exist', () => {
    const out = applyMigrations({ schemaVersion: 0 }, [v0ToV1, v1ToV2], 1);
    expect(out).toEqual({ schemaVersion: 1 });
  });

  it('throws when no migration is registered for an intermediate version', () => {
    expect(() => applyMigrations({ schemaVersion: 0 }, [v1ToV2], 2)).toThrow(
      /No migration registered from schemaVersion 0/
    );
  });

  it('throws when the document is newer than the target', () => {
    expect(() => applyMigrations({ schemaVersion: 5 }, [], 1)).toThrow(/newer than this app/);
  });
});

/**
 * Session 209b — three migration-layer findings, each with no coverage before.
 */
describe('migration-layer regressions (Session 209b)', () => {
  it('reads a QUOTED schemaVersion instead of treating the doc as v1', () => {
    // `"schemaVersion": "10"` fell through to the pre-versioning default and
    // re-ran the whole v1->v10 chain over an already-current document. `v1ToV2`
    // renumbers every annotation, so entities at #7 and #9 came back as #2 and
    // #1 — breaking `[title](#42)` references and duplicating badges. Hand- and
    // LLM-authored JSON is a first-class input here.
    const doc = {
      schemaVersion: String(CURRENT_SCHEMA_VERSION),
      id: 'd1',
      diagramType: 'crt',
      title: 'Quoted version',
      entities: {
        a: { id: 'a', type: 'effect', title: 'A', annotationNumber: 7, createdAt: 1, updatedAt: 1 },
        b: { id: 'b', type: 'effect', title: 'B', annotationNumber: 9, createdAt: 1, updatedAt: 1 },
      },
      edges: {},
      groups: {},
      resolvedWarnings: {},
      nextAnnotationNumber: 10,
      createdAt: 1,
      updatedAt: 1,
    };
    const out = migrateToCurrent(doc) as typeof doc;
    expect(out.entities.a.annotationNumber).toBe(7);
    expect(out.entities.b.annotationNumber).toBe(9);
  });

  it('v6->v7 does not mutate its input (the loop is documented as pure)', () => {
    // The fixture has to make v6->v7 actually WRITE: it minted first-class
    // assumption records into `raw.assumptions` by alias, so the mutation only
    // shows up when there is an assumption-entity with a host edge to convert.
    // An empty `assumptions: {}` proves nothing.
    const raw = {
      schemaVersion: 6,
      id: 'd1',
      diagramType: 'ec',
      entities: {
        e1: {
          id: 'e1',
          type: 'effect',
          title: 'Cause',
          annotationNumber: 1,
          createdAt: 1,
          updatedAt: 1,
        },
        a1: {
          id: 'a1',
          type: 'assumption',
          title: 'The belief behind the arrow',
          annotationNumber: 2,
          createdAt: 1,
          updatedAt: 1,
        },
      },
      edges: {
        ed1: {
          id: 'ed1',
          sourceId: 'e1',
          targetId: 'e1',
          kind: 'necessity',
          assumptionIds: ['a1'],
        },
      },
      groups: {},
      resolvedWarnings: {},
      assumptions: {},
      nextAnnotationNumber: 3,
      createdAt: 1,
      updatedAt: 1,
    };
    const before = JSON.stringify(raw);
    // Through the real registry: if ANY step writes into its input, the
    // serialized original changes.
    migrateToCurrent(raw);
    expect(JSON.stringify(raw)).toBe(before);
  });

  it('v9->v10 does not leave groups pointing at the entities it removed', () => {
    // The pivot turns assumption-ENTITIES into first-class records. Groups that
    // contained them kept the now-dangling ids, and that state persisted
    // through every export and every later save.
    const raw = {
      schemaVersion: 9,
      id: 'd1',
      diagramType: 'ec',
      entities: {
        e1: {
          id: 'e1',
          type: 'effect',
          title: 'Real',
          annotationNumber: 1,
          createdAt: 1,
          updatedAt: 1,
        },
        a1: {
          id: 'a1',
          type: 'assumption',
          title: 'An assumption',
          annotationNumber: 2,
          createdAt: 1,
          updatedAt: 1,
        },
      },
      edges: {
        ed1: {
          id: 'ed1',
          sourceId: 'e1',
          targetId: 'e1',
          kind: 'necessity',
          assumptionIds: ['a1'],
        },
      },
      groups: {
        g1: {
          id: 'g1',
          title: 'Mixed',
          color: 'indigo',
          memberIds: ['e1', 'a1'],
          collapsed: false,
          createdAt: 1,
          updatedAt: 1,
        },
        g2: {
          id: 'g2',
          title: 'Only assumptions',
          color: 'indigo',
          memberIds: ['a1'],
          collapsed: false,
          createdAt: 1,
          updatedAt: 1,
        },
      },
      resolvedWarnings: {},
      nextAnnotationNumber: 3,
      createdAt: 1,
      updatedAt: 1,
    };
    const out = migrateToCurrent(raw) as {
      entities: Record<string, unknown>;
      groups: Record<string, { memberIds: string[] }>;
    };

    expect(out.entities.a1).toBeUndefined();
    expect(out.groups.g1?.memberIds).toEqual(['e1']);
    // A group left with nothing is dropped rather than kept as a phantom,
    // matching what `deleteEntity` does.
    expect(out.groups.g2).toBeUndefined();
  });
});
