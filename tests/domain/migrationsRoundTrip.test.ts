import { importFromJSON } from '@/domain/persistence';
import { describe, expect, it } from 'vitest';

/**
 * Migration round-trip — feed `importFromJSON` a minimal document at each
 * past schemaVersion (1, 2, 3, 4) and assert the migration chain produces
 * a valid v5 document.
 *
 * The fixtures are deliberately tiny: a single entity, a single edge, no
 * groups. We don't need full real-world docs — the migration functions
 * are pure transforms whose only branch is "is this an object?". A small
 * fixture catches the same regressions as a large one, faster.
 *
 * If a future migration changes shape in a way the older fixtures can't
 * survive, this test will fail loudly. That's the whole point: the
 * regression is caught before users with v3-era docs hit it.
 */

const baseFields = (version: number, extras: Record<string, unknown> = {}) => ({
  id: 'doc-1',
  title: `v${version} fixture`,
  diagramType: 'crt',
  schemaVersion: version,
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
  entities: {
    'e-1': {
      id: 'e-1',
      type: 'ude',
      title: 'Sample UDE',
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      // annotationNumber added by v1→v2 migration
    },
  },
  edges: {},
  ...extras,
});

describe('schema migrations round-trip', () => {
  it('imports a v1 fixture → v5 doc with annotationNumber + groups + nextAnnotationNumber', () => {
    const v1 = {
      ...baseFields(1, {
        // v1 docs predate `nextAnnotationNumber` AND `groups`. Force the
        // fixture to omit both so the migration chain has to invent them.
      }),
    };
    // v1 fixtures are missing nextAnnotationNumber + groups — strip from
    // the base (we accidentally include groups via the spread).
    // Strip `nextAnnotationNumber` and `groups` from the fixture by
    // shallow-copying just the kept keys. Avoids `delete`, which Biome
    // flags as a perf antipattern (and we don't need it here — the
    // fixture is a fresh object literal).
    const { nextAnnotationNumber: _na, groups: _g, ...raw } = v1 as Record<string, unknown>;

    const doc = importFromJSON(JSON.stringify(raw));

    expect(doc.schemaVersion).toBe(6);
    expect(doc.groups).toEqual({});
    expect(doc.nextAnnotationNumber).toBe(2); // 1 entity → next is 2
    // v1→v2 assigns annotationNumber 1 to the single entity.
    const entity = Object.values(doc.entities)[0];
    expect(entity?.annotationNumber).toBe(1);
  });

  it('imports a v2 fixture → v5 doc (groups gets added empty)', () => {
    const v2 = baseFields(2, {
      nextAnnotationNumber: 2,
    });
    // v2 fixture includes annotationNumber on entities — the migration
    // chain shouldn't touch it. Strip `groups` (v2 docs predated the
    // group system) by destructured-rest pattern to avoid `delete`.
    const { groups: _g, ...rest } = v2 as Record<string, unknown>;
    const raw = {
      ...rest,
      entities: {
        'e-1': {
          ...((v2.entities as Record<string, Record<string, unknown>>)['e-1'] ?? {}),
          annotationNumber: 1,
        },
      },
    };

    const doc = importFromJSON(JSON.stringify(raw));

    expect(doc.schemaVersion).toBe(6);
    expect(doc.groups).toEqual({});
    expect(doc.nextAnnotationNumber).toBe(2);
    expect(Object.values(doc.entities)[0]?.annotationNumber).toBe(1);
  });

  it('imports a v3 fixture → v5 doc (purely a version bump path)', () => {
    const v3 = baseFields(3, {
      nextAnnotationNumber: 2,
      groups: {},
      entities: {
        'e-1': {
          id: 'e-1',
          type: 'ude',
          title: 'Sample UDE',
          annotationNumber: 1,
          createdAt: 1700000000000,
          updatedAt: 1700000000000,
        },
      },
    });
    const doc = importFromJSON(JSON.stringify(v3));
    expect(doc.schemaVersion).toBe(6);
  });

  it('imports a v4 fixture → v5 doc (single version bump)', () => {
    const v4 = baseFields(4, {
      nextAnnotationNumber: 2,
      groups: {},
      entities: {
        'e-1': {
          id: 'e-1',
          type: 'ude',
          title: 'Sample UDE',
          annotationNumber: 1,
          createdAt: 1700000000000,
          updatedAt: 1700000000000,
        },
      },
    });
    const doc = importFromJSON(JSON.stringify(v4));
    expect(doc.schemaVersion).toBe(6);
  });

  it('rejects a future-version document with a clear error', () => {
    const v99 = baseFields(99, { nextAnnotationNumber: 2, groups: {} });
    expect(() => importFromJSON(JSON.stringify(v99))).toThrow(/newer than this app supports/);
  });
});
