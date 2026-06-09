import { describe, expect, it } from 'vitest';
import { importFromJSON } from '@/domain/persistence';

/**
 * Migration round-trip — feed `importFromJSON` a minimal document at each
 * past schemaVersion and assert the migration chain produces a valid
 * current-version document.
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

    expect(doc.schemaVersion).toBe(10);
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

    expect(doc.schemaVersion).toBe(10);
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
    expect(doc.schemaVersion).toBe(10);
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
    expect(doc.schemaVersion).toBe(10);
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
    expect(doc.schemaVersion).toBe(10);
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
    expect(doc.schemaVersion).toBe(10);
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
    expect(doc.schemaVersion).toBe(10);
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
    expect(doc.schemaVersion).toBe(10);
    expect(doc.ecVerbalStyle).toBe('twoSided');
  });

  // Session — v9→v10: record-canonical assumptions. The pivot moves every
  // `type:'assumption'` entity OUT of `doc.entities` into `doc.assumptions`,
  // re-anchors its comments to `{kind:'assumption'}`, and keeps the edge's
  // `assumptionIds` membership index.
  it('imports a v9 doc with an assumption entity + record → v10 record-only, comment re-anchored', () => {
    const T = 1700000000000;
    const v9 = {
      id: 'doc-asm',
      title: 'v9 assumption fixture',
      diagramType: 'crt',
      schemaVersion: 9,
      createdAt: T,
      updatedAt: T,
      nextAnnotationNumber: 4,
      groups: {},
      entities: {
        s: {
          id: 's',
          type: 'rootCause',
          title: 'Cause',
          annotationNumber: 1,
          createdAt: T,
          updatedAt: T,
        },
        t: {
          id: 't',
          type: 'ude',
          title: 'Effect',
          annotationNumber: 2,
          createdAt: T,
          updatedAt: T,
        },
        // The legacy assumption-Entity (with the canonical annotation number).
        asm: {
          id: 'asm',
          type: 'assumption',
          title: 'because the budget holds',
          annotationNumber: 3,
          createdAt: T,
          updatedAt: T,
        },
      },
      edges: {
        e1: { id: 'e1', sourceId: 's', targetId: 't', kind: 'sufficiency', assumptionIds: ['asm'] },
      },
      // The dual-written record — but missing annotationNumber (records minted
      // by v6→v7 predate that field), so the migration must back-fill it.
      assumptions: {
        asm: {
          id: 'asm',
          edgeId: 'e1',
          text: 'because the budget holds',
          status: 'valid',
          createdAt: T,
          updatedAt: T,
        },
      },
      comments: {
        c1: {
          id: 'c1',
          anchor: { kind: 'entity', entityId: 'asm' },
          body: 'is this still true?',
          author: 'Dann',
          createdAt: T,
          updatedAt: T,
        },
      },
    };
    const doc = importFromJSON(JSON.stringify(v9));
    expect(doc.schemaVersion).toBe(10);
    // The assumption is no longer an entity; the real nodes survive.
    expect(doc.entities.asm).toBeUndefined();
    expect(doc.entities.s).toBeDefined();
    expect(doc.entities.t).toBeDefined();
    // The record is canonical; annotationNumber back-filled from the entity.
    expect(doc.assumptions?.asm?.text).toBe('because the budget holds');
    expect(doc.assumptions?.asm?.status).toBe('valid');
    expect(doc.assumptions?.asm?.annotationNumber).toBe(3);
    // The per-edge membership index is preserved (removed only in a later phase).
    expect(doc.edges.e1?.assumptionIds).toEqual(['asm']);
    // The comment is re-anchored from {kind:'entity'} to {kind:'assumption'}.
    const c = doc.comments?.c1;
    expect(c?.anchor.kind).toBe('assumption');
    if (c?.anchor.kind === 'assumption') expect(c.anchor.assumptionId).toBe('asm');
  });

  it('imports a v9 doc whose assumption entity has NO record → back-fills via reverse-walk', () => {
    const T = 1700000000000;
    const v9 = {
      id: 'doc-asm2',
      title: 'v9 assumption without record',
      diagramType: 'crt',
      schemaVersion: 9,
      createdAt: T,
      updatedAt: T,
      nextAnnotationNumber: 4,
      groups: {},
      entities: {
        s: {
          id: 's',
          type: 'rootCause',
          title: 'Cause',
          annotationNumber: 1,
          createdAt: T,
          updatedAt: T,
        },
        t: {
          id: 't',
          type: 'ude',
          title: 'Effect',
          annotationNumber: 2,
          createdAt: T,
          updatedAt: T,
        },
        asm: {
          id: 'asm',
          type: 'assumption',
          title: 'reverse-walk me',
          annotationNumber: 3,
          createdAt: T,
          updatedAt: T,
        },
      },
      edges: {
        e1: { id: 'e1', sourceId: 's', targetId: 't', kind: 'sufficiency', assumptionIds: ['asm'] },
      },
      // No first-class record exists — the migration must mint one.
      assumptions: {},
    };
    const doc = importFromJSON(JSON.stringify(v9));
    expect(doc.schemaVersion).toBe(10);
    expect(doc.entities.asm).toBeUndefined();
    expect(doc.assumptions?.asm?.edgeId).toBe('e1'); // reverse-walked from the edge
    expect(doc.assumptions?.asm?.text).toBe('reverse-walk me');
    expect(doc.assumptions?.asm?.status).toBe('unexamined');
    expect(doc.assumptions?.asm?.annotationNumber).toBe(3);
  });

  it('imports a v9 doc with a STANDALONE assumption entity → re-typed to a note (non-destructive)', () => {
    const T = 1700000000000;
    const v9 = {
      id: 'doc-asm3',
      title: 'v9 standalone assumption node',
      diagramType: 'freeform',
      schemaVersion: 9,
      createdAt: T,
      updatedAt: T,
      nextAnnotationNumber: 3,
      groups: {},
      entities: {
        e: {
          id: 'e',
          type: 'effect',
          title: 'A box',
          annotationNumber: 1,
          createdAt: T,
          updatedAt: T,
        },
        // A free-floating assumption NODE the user added via the old palette —
        // attached to no edge and carrying no first-class record.
        loose: {
          id: 'loose',
          type: 'assumption',
          title: 'a side claim',
          annotationNumber: 2,
          position: { x: 120, y: 80 },
          createdAt: T,
          updatedAt: T,
        },
      },
      edges: {},
      assumptions: {},
    };
    const doc = importFromJSON(JSON.stringify(v9));
    expect(doc.schemaVersion).toBe(10);
    // Preserved, not dropped — re-typed to a note keeping its title + position.
    expect(doc.entities.loose?.type).toBe('note');
    expect(doc.entities.loose?.title).toBe('a side claim');
    expect(doc.entities.loose?.position).toEqual({ x: 120, y: 80 });
    // It never became a first-class assumption record (no host edge).
    expect(doc.assumptions?.loose).toBeUndefined();
  });
});
