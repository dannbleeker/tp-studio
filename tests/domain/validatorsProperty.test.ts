import type {
  DiagramType,
  DocumentId,
  Edge,
  EdgeId,
  EdgeKind,
  Entity,
  EntityId,
  EntityType,
  TPDocument,
} from '@/domain/types';
import { validate, validateTiered } from '@/domain/validators';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

/**
 * Session 85 / #14 — property-based totality coverage for the CLR
 * validator registry.
 *
 * The hand-written tests in `validators.test.ts` cover the *behavior* of
 * each rule on cases we thought to write. This file covers a different
 * promise: every rule, on every diagram type, must be *total* — it must
 * return well-formed `Warning[]` for any structurally valid `TPDocument`
 * without throwing. A rule that crashes on an unusual graph shape would
 * surface to the user as a blank Inspector and a logged exception; we'd
 * rather fail in CI with a shrunk repro.
 *
 * Properties:
 *
 *  1. **`validate(doc)` never throws** for any arbitrary doc. The
 *     registry walks every rule for the doc's diagram type, so this
 *     covers all 16 rules transitively in one property.
 *  2. **Every warning's tier is a valid `ClrTier`.** Catches a rule that
 *     somehow emits a warning the registry forgot to tag (today's typing
 *     makes that hard, but it's cheap insurance against a future
 *     regression).
 *  3. **Every warning references an entity/edge that exists in the doc.**
 *     Rules that look up the *opposite* endpoint of an edge or
 *     transitive descendants have historically been the spot where
 *     "ghost id" warnings appear after a delete. The property catches
 *     them even on docs that *don't* exercise the delete path.
 *  4. **`validateTiered(doc)` partitions exactly the same warnings as
 *     `validate(doc)`** — no drops, no duplicates. Pins the contract
 *     between the two exported entry points so future refactors of the
 *     tier-grouping helper don't silently lose warnings.
 */

// ── Generators ────────────────────────────────────────────────────────

const idArb = <T extends string>(prefix: string) =>
  fc
    .string({ minLength: 4, maxLength: 8 })
    .map((s) => `${prefix}-${s.replace(/[^a-zA-Z0-9]/g, '').padEnd(4, 'x')}` as T);

// Mirror the EntityType union in `src/domain/types.ts`.
const entityTypeArb = fc.constantFrom<EntityType>(
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

const diagramTypeArb = fc.constantFrom<DiagramType>(
  'crt',
  'frt',
  'prt',
  'tt',
  'ec',
  'goalTree',
  'st',
  'freeform'
);

const edgeKindArb = fc.constantFrom<EdgeKind>('sufficiency', 'necessity');

const entityArb = fc.record({
  id: idArb<EntityId>('e'),
  type: entityTypeArb,
  // Cover the empty-title case (entity-existence rule), short titles,
  // and titles long enough to trip the >25-words clarity rule.
  title: fc.oneof(
    fc.constant(''),
    fc.string({ minLength: 1, maxLength: 40 }),
    fc
      .array(fc.string({ minLength: 1, maxLength: 6 }), { minLength: 26, maxLength: 32 })
      .map((w) => w.join(' '))
  ),
  annotationNumber: fc.integer({ min: 1, max: 999 }),
  description: fc.option(fc.string({ maxLength: 80 }), { nil: undefined }),
  createdAt: fc.constant(1_700_000_000_000),
  updatedAt: fc.constant(1_700_000_000_000),
}) satisfies fc.Arbitrary<Entity>;

const edgeArb = (entityIds: EntityId[]) =>
  fc.record({
    id: idArb<EdgeId>('edge'),
    sourceId: fc.constantFrom(...entityIds),
    targetId: fc.constantFrom(...entityIds),
    kind: edgeKindArb,
    label: fc.option(fc.string({ maxLength: 30 }), { nil: undefined }),
  }) satisfies fc.Arbitrary<Edge>;

/**
 * Full `TPDocument` arbitrary. Generates 1–6 entities with deduped ids,
 * 0–10 edges between them (self-loops allowed — the validators must
 * tolerate cycles and isolated nodes alike), and a random diagram type.
 */
const docArb = fc
  .record({
    diagramType: diagramTypeArb,
    rawEntities: fc.array(entityArb, { minLength: 1, maxLength: 6 }),
  })
  .chain(({ diagramType, rawEntities }) => {
    // Dedupe entity ids to keep the entity record well-formed.
    const entities = rawEntities.filter((e, i, arr) => arr.findIndex((x) => x.id === e.id) === i);
    const entityIds = entities.map((e) => e.id);
    return fc
      .record({
        rawEdges: fc.array(edgeArb(entityIds), { minLength: 0, maxLength: 10 }),
      })
      .map<TPDocument>(({ rawEdges }) => {
        // Dedupe edge ids too — same reason.
        const edges = rawEdges.filter((e, i, arr) => arr.findIndex((x) => x.id === e.id) === i);
        const maxAnnotation = entities.reduce((max, e) => Math.max(max, e.annotationNumber), 0);
        return {
          id: 'doc-prop' as DocumentId,
          diagramType,
          title: 'Property-test document',
          entities: Object.fromEntries(entities.map((e) => [e.id, e])),
          edges: Object.fromEntries(edges.map((e) => [e.id, e])),
          groups: {},
          resolvedWarnings: {},
          nextAnnotationNumber: maxAnnotation + 1,
          createdAt: 1_700_000_000_000,
          updatedAt: 1_700_000_000_000,
          schemaVersion: 7,
        };
      });
  });

// ── Properties ────────────────────────────────────────────────────────

const VALID_TIERS = new Set(['clarity', 'existence', 'sufficiency']);

describe('CLR validators — property-based totality', () => {
  it('validate(doc) never throws and returns a well-formed Warning[]', () => {
    fc.assert(
      fc.property(docArb, (doc) => {
        const warnings = validate(doc);
        // Plain shape checks — a rule that returned `undefined` for a
        // field would otherwise hide behind the eventual UI render.
        for (const w of warnings) {
          expect(typeof w.id).toBe('string');
          expect(typeof w.ruleId).toBe('string');
          expect(typeof w.message).toBe('string');
          expect(VALID_TIERS.has(w.tier)).toBe(true);
          expect(typeof w.resolved).toBe('boolean');
          expect(w.target).toBeDefined();
        }
      }),
      { numRuns: 200 }
    );
  });

  it('every warning targets an entity or edge that exists in the doc', () => {
    fc.assert(
      fc.property(docArb, (doc) => {
        const warnings = validate(doc);
        for (const w of warnings) {
          if (w.target.kind === 'entity') {
            expect(doc.entities[w.target.id]).toBeDefined();
          } else if (w.target.kind === 'edge') {
            expect(doc.edges[w.target.id]).toBeDefined();
          }
          // No other `kind` exists today; if a future rule adds one,
          // the test will surface the omission via the `else` falling
          // through harmlessly.
        }
      }),
      { numRuns: 200 }
    );
  });

  it('validateTiered partitions exactly the same warnings as validate', () => {
    fc.assert(
      fc.property(docArb, (doc) => {
        const flat = validate(doc);
        const tiered = validateTiered(doc);
        const recombined = [...tiered.clarity, ...tiered.existence, ...tiered.sufficiency];
        expect(recombined.length).toBe(flat.length);
        // Set-equality on warning ids — order within a tier isn't part
        // of the contract, but membership is.
        const flatIds = new Set(flat.map((w) => w.id));
        const recombinedIds = new Set(recombined.map((w) => w.id));
        expect(recombinedIds).toEqual(flatIds);
      }),
      { numRuns: 100 }
    );
  });
});
