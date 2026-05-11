import {
  CURRENT_SCHEMA_VERSION,
  type Migration,
  applyMigrations,
  migrateToCurrent,
} from '@/domain/migrations';
import { describe, expect, it } from 'vitest';

const passthroughDoc = { schemaVersion: 1, foo: 'bar' };

describe('migrateToCurrent', () => {
  it('returns a CURRENT_SCHEMA_VERSION document unchanged in shape', () => {
    expect(migrateToCurrent(passthroughDoc)).toEqual(passthroughDoc);
  });

  it('treats a missing schemaVersion as 1 (current)', () => {
    const doc = { foo: 'bar' };
    expect(migrateToCurrent(doc)).toEqual(doc);
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
