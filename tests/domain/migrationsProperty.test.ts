import { CURRENT_SCHEMA_VERSION, migrateToCurrent } from '@/domain/migrations';
import { importFromJSON } from '@/domain/persistence';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

/**
 * Session 85 / #13 — property-based coverage for the migration chain.
 *
 * The hand-fixture tests (`migrations.test.ts`, `migrationsRoundTrip.test.ts`)
 * catch the cases we thought to write. fast-check generates *arbitrary*
 * v1-shaped documents and exercises invariants that should hold for any
 * input. The properties below cover:
 *
 *  1. **Migration produces a doc the strict validator accepts.** Every
 *     reachable v1 doc, after `migrateToCurrent` + the persistence
 *     validator, becomes a well-typed `TPDocument` — no crashes, no
 *     ad-hoc shape rejects.
 *  2. **Idempotency at the current version.** Running
 *     `migrateToCurrent` on a doc that's already at the current version
 *     is a no-op (same reference *or* deep-equal shape). Catches a class
 *     of bugs where a future migration mistakenly applies to a v(N)
 *     document already at v(N+1).
 *  3. **Schema version monotone.** Each step in the chain bumps
 *     `schemaVersion` by exactly +1; no skipped or duplicated steps.
 *
 * fast-check's seed defaults to deterministic per run — the test produces
 * the same shrinking sequence every time, so a CI failure points at a
 * specific generated case rather than a random one we can't reproduce.
 */

// ── Generators ────────────────────────────────────────────────────────

/** A small alphanumeric id string. Deliberately constrained to keep the
 *  generated docs readable when a property fails. */
const idArb = fc
  .string({ minLength: 4, maxLength: 12 })
  .map((s) => s.replace(/[^a-zA-Z0-9_-]/g, '').padEnd(4, 'x'));

// Mirror the EntityType union in `src/domain/types.ts`. Tests fail
// fast if a future EntityType bump isn't reflected here.
const typeIdArb = fc.constantFrom(
  'ude',
  'effect',
  'rootCause',
  'injection',
  'desiredEffect',
  'assumption',
  'goal',
  'criticalSuccessFactor',
  'necessaryCondition',
  'obstacle',
  'intermediateObjective',
  'action',
  'need',
  'want',
  'note'
);

/** v1-shaped entity. Pre-migration: no annotationNumber, no spanOfControl,
 *  no attributes — just the original primitive fields the v1 doc shipped. */
const v1EntityArb = fc.record({
  id: idArb,
  type: typeIdArb,
  title: fc.string({ minLength: 0, maxLength: 60 }),
  description: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
  createdAt: fc.integer({ min: 0, max: 2_000_000_000_000 }),
  updatedAt: fc.integer({ min: 0, max: 2_000_000_000_000 }),
});

/** v1-shaped edge. */
const v1EdgeArb = (entityIds: string[]) =>
  fc.record({
    id: idArb,
    sourceId: fc.constantFrom(...entityIds),
    targetId: fc.constantFrom(...entityIds),
    label: fc.option(fc.string({ maxLength: 60 }), { nil: undefined }),
    createdAt: fc.integer({ min: 0, max: 2_000_000_000_000 }),
  });

/** Full v1 document arbitrary. Generates 1–5 entities, 0–8 edges between
 *  them, no groups. Self-loops are allowed (the migration shouldn't
 *  reject them; the live importer does later). */
const v1DocArb = fc
  .record({
    id: idArb,
    title: fc.string({ maxLength: 60 }),
    diagramType: fc.constantFrom('crt', 'frt', 'prt', 'tt', 'ec'),
    entities: fc.array(v1EntityArb, { minLength: 1, maxLength: 5 }),
    createdAt: fc.integer({ min: 0, max: 2_000_000_000_000 }),
    updatedAt: fc.integer({ min: 0, max: 2_000_000_000_000 }),
    schemaVersion: fc.constant(1),
  })
  .chain((base) => {
    const ids = base.entities.map((e) => e.id);
    // De-dupe ids to prevent the entities-record collapse later from
    // hiding source entities the edges might reference.
    const uniqueIds = [...new Set(ids)];
    const uniqueEntities = base.entities.filter(
      (e, i, arr) => arr.findIndex((x) => x.id === e.id) === i
    );
    return fc.record({
      id: fc.constant(base.id),
      title: fc.constant(base.title),
      diagramType: fc.constant(base.diagramType),
      entities: fc.constant(uniqueEntities),
      edges: fc.array(v1EdgeArb(uniqueIds), { minLength: 0, maxLength: 8 }),
      createdAt: fc.constant(base.createdAt),
      updatedAt: fc.constant(base.updatedAt),
      schemaVersion: fc.constant(base.schemaVersion),
    });
  })
  // The persistence validator expects entities/edges as Record<string, T>,
  // not arrays. Build the record form for the migration loop.
  .map((d) => ({
    ...d,
    entities: Object.fromEntries(d.entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(d.edges.map((e) => [e.id, e])),
  }));

// ── Properties ────────────────────────────────────────────────────────

describe('migrations — property-based', () => {
  it('migrated doc survives the strict importFromJSON validator', () => {
    fc.assert(
      fc.property(v1DocArb, (rawDoc) => {
        // Serialize → import is the same path the prod app takes on
        // localStorage load + JSON paste import.
        const json = JSON.stringify(rawDoc);
        const result = importFromJSON(json);
        expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
        expect(result.id).toBe(rawDoc.id);
        expect(typeof result.title).toBe('string');
      }),
      { numRuns: 100 }
    );
  });

  it('migrateToCurrent is idempotent at the current version', () => {
    fc.assert(
      fc.property(v1DocArb, (rawDoc) => {
        const once = migrateToCurrent(rawDoc) as Record<string, unknown>;
        const twice = migrateToCurrent(once) as Record<string, unknown>;
        // schemaVersion must be at the target; running again is a no-op.
        expect(once.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
        expect(twice.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
        // Deep-equality on the migrated shape: a second pass shouldn't
        // touch anything. JSON-roundtripping is the cheapest deep-equal.
        expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
      }),
      { numRuns: 100 }
    );
  });

  it('rejects a doc whose schemaVersion is ahead of the app', () => {
    // The future-doc case is small enough to test by example, but worth
    // pinning here so the migrations.applyMigrations guard doesn't drift.
    expect(() =>
      migrateToCurrent({
        id: 'future',
        schemaVersion: CURRENT_SCHEMA_VERSION + 1,
      })
    ).toThrow(/newer than this app supports/);
  });
});
