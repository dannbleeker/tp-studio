/**
 * Session 115 — extracted from `validatorsProperty.test.ts` so multiple
 * property-based test files can share one canonical TPDocument
 * generator. The original lived inline in the validators property test
 * and was a candidate for duplication every time a new PB test
 * needed an arbitrary doc.
 *
 * Generators here produce **structurally well-formed** docs (deduped
 * ids, branded EntityId / EdgeId types, schemaVersion = 8) suitable
 * for downstream PB tests that want to assert "for any valid doc, X
 * holds." They do NOT exercise pathological shapes — e.g. assumptions
 * map, custom entity classes, groups, layout config. Add field-
 * specific arbitraries here when a test needs them rather than
 * sprinkling new arbitraries through individual test files.
 */
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
import * as fc from 'fast-check';

export const idArb = <T extends string>(prefix: string) =>
  fc
    .string({ minLength: 4, maxLength: 8 })
    .map((s) => `${prefix}-${s.replace(/[^a-zA-Z0-9]/g, '').padEnd(4, 'x')}` as T);

// Mirror the EntityType union in `src/domain/types.ts`. Adding a new
// type there requires adding it here so PB tests exercise it.
export const entityTypeArb = fc.constantFrom<EntityType>(
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

export const diagramTypeArb = fc.constantFrom<DiagramType>(
  'crt',
  'frt',
  'prt',
  'tt',
  'ec',
  'goalTree',
  'st',
  'freeform'
);

export const edgeKindArb = fc.constantFrom<EdgeKind>('sufficiency', 'necessity');

export const entityArb = fc.record({
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

export const edgeArb = (entityIds: EntityId[]) =>
  fc.record({
    id: idArb<EdgeId>('edge'),
    sourceId: fc.constantFrom(...entityIds),
    targetId: fc.constantFrom(...entityIds),
    kind: edgeKindArb,
    label: fc.option(fc.string({ maxLength: 30 }), { nil: undefined }),
  }) satisfies fc.Arbitrary<Edge>;

/**
 * Full `TPDocument` arbitrary. Generates 1–6 entities with deduped
 * ids, 0–10 edges between them (self-loops allowed — the validators
 * must tolerate cycles and isolated nodes alike), and a random
 * diagram type.
 */
export const docArb = fc
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
          schemaVersion: 8,
        };
      });
  });
