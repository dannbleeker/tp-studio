import { describe, expect, it } from 'vitest';
import { exportToJSON, importFromJSON } from '@/domain/persistence';
import type { DocumentId, Entity, EntityId } from '@/domain/types';
import { makeDoc, makeEdge, makeEntity, resetIds } from './helpers';

/**
 * Session 135 / suggested-bundle #3 — table-driven entity-roundtrip
 * smoke test.
 *
 * The motivation is the owner / lastValidatedAt round-trip bug that
 * shipped earlier this session: both fields were declared on the
 * Entity type but the persistence validator silently dropped them on
 * import (the field-by-field re-emit didn't list them). The bug went
 * undetected for a session because no test built an entity with the
 * field set, exported it to JSON, re-imported it, and asserted the
 * field survived.
 *
 * This test fixes that gap once. One entity is built with every
 * optional field set to a distinctive value; the doc is exported to
 * JSON, re-imported, and every field is asserted survived intact. A
 * future "field added to Entity but not to the validator" regression
 * fails this test loudly at PR time instead of slipping into a
 * release.
 *
 * Adding a new optional field to Entity: bump the entity below with
 * a distinctive value for the new field, add a matching `expect()`
 * assertion. The test fails until the persistence validator emits
 * the field on the way out.
 */

describe('persistence round-trip — every optional Entity field', () => {
  it('preserves every documented optional field on JSON export + re-import', () => {
    resetIds();
    // Build one entity with every documented optional field set to
    // a distinctive value. Required fields use defaults from
    // `makeEntity`.
    const ent: Entity = makeEntity({
      type: 'ude',
      title: 'Customer churn',
      annotationNumber: 42,
      description: 'A markdown-formatted description.',
      titleSize: 'lg',
      collapsed: true,
      ordering: 7,
      position: { x: 123.5, y: -42.5 },
      attestation: 'Source: 2024 churn analysis (linked).',
      owner: 'Alice (interim VP)',
      lastValidatedAt: 1_734_500_000_000,
      unspecified: false, // explicit `false` should be omitted on round-trip
      spanOfControl: 'influence',
      ecSlot: 'a',
      attributes: {
        priority: { kind: 'int', value: 1 },
        contact: { kind: 'string', value: 'alice@example.com' },
        confidence: { kind: 'real', value: 0.85 },
        flagged: { kind: 'bool', value: true },
      },
      evidence: [
        {
          id: 'ev-1',
          description: 'p95 latency = 740ms',
          source: 'metric',
          strength: 'strong',
          url: 'https://example.com/dashboard',
          validatedAt: 1_734_400_000_000,
          validatedBy: 'Alice',
          createdAt: 1_734_300_000_000,
          updatedAt: 1_734_350_000_000,
        },
        {
          id: 'ev-2',
          description: 'CFO assertion in Q4 review',
          source: 'stakeholder',
          strength: 'moderate',
          createdAt: 1_734_300_000_000,
          updatedAt: 1_734_300_000_000,
        },
      ],
      // Session 135 / spec gap #3 Phase 1A — cross-diagram traceability.
      // Session 137 — fields tightened to `DocumentId` / `EntityId`
      // brands; test fixtures cast plain strings at the seam.
      importedFrom: {
        docId: 'src-doc-id-abc123' as DocumentId,
        entityId: 'src-entity-id-def456' as EntityId,
        sourceTitle: 'Original entity title',
        importedAt: '2026-05-21T08:00:00.000Z',
      },
      // Session 135 / spec gap #4 Phase 1A — entity-state tag.
      state: 'disputed',
    });

    const doc = makeDoc([ent], []);
    const json = exportToJSON(doc);
    const reimported = importFromJSON(json);
    const survived = reimported.entities[ent.id];
    expect(survived).toBeDefined();
    if (!survived) return; // narrow for TS

    // Core fields
    expect(survived.id).toBe(ent.id);
    expect(survived.type).toBe('ude');
    expect(survived.title).toBe('Customer churn');
    expect(survived.annotationNumber).toBe(42);
    expect(survived.createdAt).toBe(ent.createdAt);
    expect(survived.updatedAt).toBe(ent.updatedAt);

    // Optional fields — every one must survive
    expect(survived.description).toBe('A markdown-formatted description.');
    expect(survived.titleSize).toBe('lg');
    expect(survived.collapsed).toBe(true);
    expect(survived.ordering).toBe(7);
    expect(survived.position).toEqual({ x: 123.5, y: -42.5 });
    expect(survived.attestation).toBe('Source: 2024 churn analysis (linked).');
    expect(survived.owner).toBe('Alice (interim VP)');
    expect(survived.lastValidatedAt).toBe(1_734_500_000_000);
    // `unspecified: false` is omitted on round-trip per the validator's
    // "only emit `true`" rule — assert that explicitly so future
    // changes to the emit rule surface here.
    expect(survived.unspecified).toBeUndefined();
    expect(survived.spanOfControl).toBe('influence');
    expect(survived.ecSlot).toBe('a');

    // Attributes — full tagged union shape
    expect(survived.attributes).toEqual({
      priority: { kind: 'int', value: 1 },
      contact: { kind: 'string', value: 'alice@example.com' },
      confidence: { kind: 'real', value: 0.85 },
      flagged: { kind: 'bool', value: true },
    });

    // Evidence — full per-item shape, including the optional fields
    // that only the first item carries (url, validatedAt, validatedBy)
    expect(survived.evidence).toHaveLength(2);
    const [ev1, ev2] = survived.evidence ?? [];
    expect(ev1).toEqual({
      id: 'ev-1',
      description: 'p95 latency = 740ms',
      source: 'metric',
      strength: 'strong',
      url: 'https://example.com/dashboard',
      validatedAt: 1_734_400_000_000,
      validatedBy: 'Alice',
      createdAt: 1_734_300_000_000,
      updatedAt: 1_734_350_000_000,
    });
    expect(ev2).toEqual({
      id: 'ev-2',
      description: 'CFO assertion in Q4 review',
      source: 'stakeholder',
      strength: 'moderate',
      createdAt: 1_734_300_000_000,
      updatedAt: 1_734_300_000_000,
    });

    // ImportedFrom — full shape with both optional fields set.
    expect(survived.importedFrom).toEqual({
      docId: 'src-doc-id-abc123',
      entityId: 'src-entity-id-def456',
      sourceTitle: 'Original entity title',
      importedAt: '2026-05-21T08:00:00.000Z',
    });

    // Session 135 / spec gap #4 Phase 1A — entity-state tag.
    expect(survived.state).toBe('disputed');
  });

  it('preserves a minimal entity (no optionals) without inventing fields', () => {
    resetIds();
    const ent = makeEntity({ title: 'Just a title' });
    const doc = makeDoc([ent], []);
    const reimported = importFromJSON(exportToJSON(doc));
    const survived = reimported.entities[ent.id];
    expect(survived).toBeDefined();
    if (!survived) return;
    // None of the optional fields should appear when they weren't set.
    expect(survived.description).toBeUndefined();
    expect(survived.titleSize).toBeUndefined();
    expect(survived.collapsed).toBeUndefined();
    expect(survived.ordering).toBeUndefined();
    expect(survived.position).toBeUndefined();
    expect(survived.attestation).toBeUndefined();
    expect(survived.owner).toBeUndefined();
    expect(survived.lastValidatedAt).toBeUndefined();
    expect(survived.unspecified).toBeUndefined();
    expect(survived.spanOfControl).toBeUndefined();
    expect(survived.ecSlot).toBeUndefined();
    expect(survived.attributes).toBeUndefined();
    expect(survived.evidence).toBeUndefined();
    expect(survived.importedFrom).toBeUndefined();
    expect(survived.state).toBeUndefined();
  });

  it('preserves an importedFrom ref with only the required fields (no sourceTitle / importedAt)', () => {
    resetIds();
    const ent = makeEntity({
      title: 'Imported entity',
      importedFrom: { docId: 'doc-abc' as DocumentId, entityId: 'ent-xyz' as EntityId },
    });
    const doc = makeDoc([ent], []);
    const reimported = importFromJSON(exportToJSON(doc));
    const survived = reimported.entities[ent.id];
    expect(survived?.importedFrom).toEqual({ docId: 'doc-abc', entityId: 'ent-xyz' });
    // Optionals stay absent on minimal ref.
    expect(survived?.importedFrom?.sourceTitle).toBeUndefined();
    expect(survived?.importedFrom?.importedAt).toBeUndefined();
  });

  it('rejects an entity with an unknown state value', () => {
    // Session 135 / spec gap #4 Phase 1A — entity-state.
    // The validator enumerates the allowed state values; anything
    // else should throw rather than silently pass through.
    const malformed = JSON.stringify({
      schemaVersion: 9,
      id: 'doc-test',
      diagramType: 'crt',
      title: 'malformed-state',
      nextAnnotationNumber: 2,
      groups: {},
      resolvedWarnings: {},
      createdAt: 1,
      updatedAt: 1,
      entities: {
        e1: {
          id: 'e1',
          type: 'effect',
          title: 'x',
          annotationNumber: 1,
          createdAt: 1,
          updatedAt: 1,
          state: 'maybe', // not one of true | false | unknown | disputed
        },
      },
      edges: {},
    });
    expect(() => importFromJSON(malformed)).toThrow(/state/i);
  });

  it('preserves an assumption kind (S&T sub-typing) across round-trip', () => {
    // Session 135 medium gap — Assumption.kind. Build a doc with one
    // edge + a typed assumption record, round-trip it, assert the
    // kind survives the validator's field-by-field re-emit.
    const raw = JSON.stringify({
      schemaVersion: 9,
      id: 'doc-test',
      diagramType: 'st',
      title: 'assumption-kind',
      nextAnnotationNumber: 3,
      groups: {},
      resolvedWarnings: {},
      createdAt: 1,
      updatedAt: 1,
      entities: {
        e1: {
          id: 'e1',
          type: 'effect',
          title: 'a',
          annotationNumber: 1,
          createdAt: 1,
          updatedAt: 1,
        },
        e2: {
          id: 'e2',
          type: 'effect',
          title: 'b',
          annotationNumber: 2,
          createdAt: 1,
          updatedAt: 1,
        },
      },
      edges: {
        ed1: {
          id: 'ed1',
          sourceId: 'e1',
          targetId: 'e2',
          kind: 'sufficiency',
          assumptionIds: ['as1'],
        },
      },
      assumptions: {
        as1: {
          id: 'as1',
          edgeId: 'ed1',
          text: 'Teams want clarity',
          status: 'unexamined',
          kind: 'necessary',
          createdAt: 1,
          updatedAt: 1,
        },
      },
    });
    const reimported = importFromJSON(raw);
    expect(reimported.assumptions?.as1?.kind).toBe('necessary');
  });

  it('omits an untyped assumption kind on round-trip (no kind: undefined)', () => {
    const raw = JSON.stringify({
      schemaVersion: 9,
      id: 'doc-test',
      diagramType: 'st',
      title: 'untyped-assumption',
      nextAnnotationNumber: 2,
      groups: {},
      resolvedWarnings: {},
      createdAt: 1,
      updatedAt: 1,
      entities: {
        e1: {
          id: 'e1',
          type: 'effect',
          title: 'a',
          annotationNumber: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
      edges: {},
      assumptions: {
        as1: {
          id: 'as1',
          edgeId: 'ed1',
          text: 'x',
          status: 'unexamined',
          createdAt: 1,
          updatedAt: 1,
        },
      },
    });
    const rec = importFromJSON(raw).assumptions?.as1;
    expect(rec?.kind).toBeUndefined();
    expect(rec && 'kind' in rec).toBe(false);
  });

  it('rejects an assumption with an unknown kind value', () => {
    const malformed = JSON.stringify({
      schemaVersion: 9,
      id: 'doc-test',
      diagramType: 'st',
      title: 'malformed-kind',
      nextAnnotationNumber: 2,
      groups: {},
      resolvedWarnings: {},
      createdAt: 1,
      updatedAt: 1,
      entities: {
        e1: {
          id: 'e1',
          type: 'effect',
          title: 'a',
          annotationNumber: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
      edges: {},
      assumptions: {
        as1: {
          id: 'as1',
          edgeId: 'ed1',
          text: 'x',
          status: 'unexamined',
          kind: 'mandatory', // not one of necessary | parallel | sufficient
          createdAt: 1,
          updatedAt: 1,
        },
      },
    });
    expect(() => importFromJSON(malformed)).toThrow(/kind/i);
  });

  it('preserves an archived group flag across round-trip (emit-or-omit)', () => {
    // Session 135 medium gap — Group.archived. Only `true` is emitted;
    // an un-archived group must not grow an `archived: false` field.
    const raw = JSON.stringify({
      schemaVersion: 9,
      id: 'doc-test',
      diagramType: 'crt',
      title: 'archived-group',
      nextAnnotationNumber: 2,
      resolvedWarnings: {},
      createdAt: 1,
      updatedAt: 1,
      entities: {
        e1: {
          id: 'e1',
          type: 'effect',
          title: 'a',
          annotationNumber: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
      edges: {},
      groups: {
        g1: {
          id: 'g1',
          title: 'Rejected branch',
          color: 'slate',
          memberIds: ['e1'],
          collapsed: false,
          archived: true,
          createdAt: 1,
          updatedAt: 1,
        },
        g2: {
          id: 'g2',
          title: 'Live branch',
          color: 'indigo',
          memberIds: [],
          collapsed: false,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    });
    const reimported = importFromJSON(raw);
    expect(reimported.groups.g1?.archived).toBe(true);
    const g2 = reimported.groups.g2;
    expect(g2?.archived).toBeUndefined();
    expect(g2 && 'archived' in g2).toBe(false);
  });

  it('rejects a group with a non-boolean archived field', () => {
    const malformed = JSON.stringify({
      schemaVersion: 9,
      id: 'doc-test',
      diagramType: 'crt',
      title: 'malformed-archived',
      nextAnnotationNumber: 2,
      resolvedWarnings: {},
      createdAt: 1,
      updatedAt: 1,
      entities: {},
      edges: {},
      groups: {
        g1: {
          id: 'g1',
          title: 'x',
          color: 'slate',
          memberIds: [],
          collapsed: false,
          archived: 'yes', // not a boolean
          createdAt: 1,
          updatedAt: 1,
        },
      },
    });
    expect(() => importFromJSON(malformed)).toThrow(/archived/i);
  });

  it('rejects an importedFrom ref missing docId', () => {
    // Construct a malformed doc — a ref without docId is invalid. The
    // validator should throw rather than silently drop the field.
    const malformed = JSON.stringify({
      schemaVersion: 9,
      id: 'doc-test',
      diagramType: 'crt',
      title: 'malformed',
      nextAnnotationNumber: 2,
      groups: {},
      resolvedWarnings: {},
      createdAt: 1,
      updatedAt: 1,
      entities: {
        e1: {
          id: 'e1',
          type: 'effect',
          title: 'x',
          annotationNumber: 1,
          createdAt: 1,
          updatedAt: 1,
          importedFrom: { entityId: 'something' }, // missing docId
        },
      },
      edges: {},
    });
    expect(() => importFromJSON(malformed)).toThrow(/docId/i);
  });

  it('survives a round-trip with an edge attached, preserving edge metadata', () => {
    // Smoke test for the parallel edge field set. The persistence
    // validator handles edges in a separate path; one assertion
    // sanity-checks that path stays honest.
    resetIds();
    const a = makeEntity({ title: 'Cause' });
    const b = makeEntity({ title: 'Effect' });
    // A junctor needs ≥2 inputs, so a lone member is auto-ungrouped on load
    // (Session 171). Give the AND group a second member so `andGroupId` is a
    // valid, surviving field to assert on.
    const c = makeEntity({ title: 'Co-cause' });
    const edge = makeEdge(a.id, b.id, {
      kind: 'sufficiency',
      label: 'leads to',
      description: 'edge-level prose',
      weight: 'positive',
      andGroupId: 'and-grp-1',
      isBackEdge: false, // omitted on round-trip per "emit only true"
      isMutualExclusion: true,
    });
    const coEdge = makeEdge(c.id, b.id, { andGroupId: 'and-grp-1' });
    const doc = makeDoc([a, b, c], [edge, coEdge]);
    const reimported = importFromJSON(exportToJSON(doc));
    const survived = reimported.edges[edge.id];
    expect(survived).toBeDefined();
    if (!survived) return;
    expect(survived.kind).toBe('sufficiency');
    expect(survived.label).toBe('leads to');
    expect(survived.description).toBe('edge-level prose');
    expect(survived.weight).toBe('positive');
    expect(survived.andGroupId).toBe('and-grp-1');
    expect(survived.isBackEdge).toBeUndefined();
    expect(survived.isMutualExclusion).toBe(true);
  });
});
