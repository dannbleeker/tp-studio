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

    expect(doc.schemaVersion).toBe(8);
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

    expect(doc.schemaVersion).toBe(8);
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
    expect(doc.schemaVersion).toBe(8);
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
    expect(doc.schemaVersion).toBe(8);
  });

  it('rejects a future-version document with a clear error', () => {
    const v99 = baseFields(99, { nextAnnotationNumber: 2, groups: {} });
    expect(() => importFromJSON(JSON.stringify(v99))).toThrow(/newer than this app supports/);
  });

  // Session 115 — fixtures for v5 / v6 / v7 originals. Each adds the
  // fields that schema version introduced and asserts the resulting v8
  // doc carries those fields untouched (or appropriately upgraded).
  // Until this session the v5+ chain was only covered by
  // `migrationsProperty.test.ts`'s arbitrary-doc generator; explicit
  // fixtures pin per-version behavior so a future migration that
  // accidentally rewrites a v6-era field gets caught here.

  it('imports a v5 fixture → v8 doc with attributes/customEntityClasses untouched', () => {
    // v5→v6 added Entity.attributes + TPDocument.customEntityClasses
    // (B7 + B10). A v5 fixture has neither field; the migration
    // chain shouldn't invent them, just bump the version.
    const v5 = baseFields(5, {
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
    const doc = importFromJSON(JSON.stringify(v5));
    expect(doc.schemaVersion).toBe(8);
    // v6 added these fields but only as optional; migration doesn't
    // populate empty maps in the doc (they remain undefined).
    expect(doc.customEntityClasses).toBeUndefined();
    const entity = Object.values(doc.entities)[0];
    expect(entity?.attributes).toBeUndefined();
  });

  it('imports a v6 fixture with attributes + customEntityClasses → v8 preserves both', () => {
    // v6 fixture EXERCISING the B7+B10 fields the v5→v6 migration
    // unlocked. Migrations v6→v7 and v7→v8 must preserve these
    // user-defined surfaces unchanged.
    const v6 = baseFields(6, {
      nextAnnotationNumber: 2,
      groups: {},
      customEntityClasses: {
        'risk-event': {
          id: 'risk-event',
          label: 'Risk Event',
          color: 'amber',
          supersetOf: 'effect',
        },
      },
      entities: {
        'e-1': {
          id: 'e-1',
          type: 'ude',
          title: 'Customer churn rising',
          annotationNumber: 1,
          createdAt: 1700000000000,
          updatedAt: 1700000000000,
          attributes: {
            severity: { kind: 'int', value: 8 },
            owner: { kind: 'string', value: 'Support team' },
          },
        },
      },
    });
    const doc = importFromJSON(JSON.stringify(v6));
    expect(doc.schemaVersion).toBe(8);
    expect(doc.customEntityClasses?.['risk-event']?.label).toBe('Risk Event');
    const entity = Object.values(doc.entities)[0];
    expect(entity?.attributes?.severity).toEqual({ kind: 'int', value: 8 });
    expect(entity?.attributes?.owner).toEqual({ kind: 'string', value: 'Support team' });
  });

  it('imports a v6 EC fixture → v8 doc with edges marked necessity + ecSlot assigned', () => {
    // The big migration is v6→v7: EC edges become 'necessity', and EC
    // entities at canonical seed coordinates get their slot binding.
    // This fixture exercises both. The seed coordinates here mirror
    // `EC_SEED_POSITIONS` in src/domain/migrations.ts.
    const v6ec = {
      id: 'doc-ec',
      title: 'v6 EC fixture',
      diagramType: 'ec',
      schemaVersion: 6,
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      nextAnnotationNumber: 6,
      groups: {},
      entities: {
        a: {
          id: 'a',
          type: 'goal',
          title: 'Objective',
          annotationNumber: 1,
          position: { x: 100, y: 250 },
          createdAt: 1700000000000,
          updatedAt: 1700000000000,
        },
        b: {
          id: 'b',
          type: 'need',
          title: 'Need B',
          annotationNumber: 2,
          position: { x: 450, y: 100 },
          createdAt: 1700000000000,
          updatedAt: 1700000000000,
        },
        c: {
          id: 'c',
          type: 'need',
          title: 'Need C',
          annotationNumber: 3,
          position: { x: 450, y: 400 },
          createdAt: 1700000000000,
          updatedAt: 1700000000000,
        },
        d: {
          id: 'd',
          type: 'want',
          title: 'Want D',
          annotationNumber: 4,
          position: { x: 800, y: 100 },
          createdAt: 1700000000000,
          updatedAt: 1700000000000,
        },
        dPrime: {
          id: 'dPrime',
          type: 'want',
          title: "Want D'",
          annotationNumber: 5,
          position: { x: 800, y: 400 },
          createdAt: 1700000000000,
          updatedAt: 1700000000000,
        },
      },
      edges: {
        'e-ba': { id: 'e-ba', sourceId: 'b', targetId: 'a' },
        'e-ca': { id: 'e-ca', sourceId: 'c', targetId: 'a' },
      },
    };
    const doc = importFromJSON(JSON.stringify(v6ec));
    expect(doc.schemaVersion).toBe(8);
    expect(doc.entities.a?.ecSlot).toBe('a');
    expect(doc.entities.b?.ecSlot).toBe('b');
    expect(doc.entities.c?.ecSlot).toBe('c');
    expect(doc.entities.d?.ecSlot).toBe('d');
    expect(doc.entities.dPrime?.ecSlot).toBe('dPrime');
    // EC edges all become necessity-kind.
    expect(doc.edges['e-ba']?.kind).toBe('necessity');
    expect(doc.edges['e-ca']?.kind).toBe('necessity');
  });

  it('imports a v7 fixture → v8 doc preserves ecVerbalStyle field', () => {
    // v7→v8 was a pure version bump documenting that
    // TPDocument.ecVerbalStyle (Session 87) became allowed. A v7
    // fixture with `ecVerbalStyle` set must keep it through the bump.
    const v7 = baseFields(7, {
      nextAnnotationNumber: 2,
      groups: {},
      ecVerbalStyle: 'twoSided',
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
    const doc = importFromJSON(JSON.stringify(v7));
    expect(doc.schemaVersion).toBe(8);
    expect(doc.ecVerbalStyle).toBe('twoSided');
  });
});
