import {
  CURRENT_SCHEMA_VERSION,
  type Migration,
  applyMigrations,
  migrateToCurrent,
} from '@/domain/migrations';
import { describe, expect, it } from 'vitest';

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

  it('rejects a document with a schemaVersion newer than the app supports', () => {
    expect(() => migrateToCurrent({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 })).toThrow(
      /newer than this app supports/
    );
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
