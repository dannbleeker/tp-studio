import { describe, expect, it } from 'vitest';
import type { DocumentId, Entity, EntityId, EntityLink, TPDocument } from '@/domain/types';
import { stripLinksToDoc, stripMirrorLinks } from '@/store/documentSlice/linkPrune';

/**
 * Pure-helper tests for the cross-doc dangling-link sweep. When an entity that is
 * the TARGET of a reciprocal Phase-2a link is deleted, the mirror link on the
 * other entity must be removed so it doesn't linger as a "tab closed" tombstone.
 */

const did = (id: string): DocumentId => id as unknown as DocumentId;
const eid = (id: string): EntityId => id as unknown as EntityId;

const link = (docId: string, entityId: string): EntityLink => ({
  docId: did(docId),
  entityId: eid(entityId),
});

const entity = (id: string, links?: EntityLink[]): Entity =>
  ({
    id: eid(id),
    type: 'effect',
    title: id,
    annotationNumber: 1,
    createdAt: 1,
    updatedAt: 1,
    ...(links ? { links } : {}),
  }) as Entity;

const doc = (id: string, entities: Entity[]): TPDocument =>
  ({
    id: did(id),
    diagramType: 'crt',
    title: id,
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: {},
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 2,
    createdAt: 1,
    updatedAt: 1,
    schemaVersion: 9,
  }) as TPDocument;

const mapOf = (...docs: TPDocument[]): Record<DocumentId, TPDocument> =>
  Object.fromEntries(docs.map((d) => [d.id, d])) as Record<DocumentId, TPDocument>;

describe('stripMirrorLinks', () => {
  it('removes a mirror link to a deleted entity and drops the empty field', () => {
    const b = doc('doc-b', [entity('b1', [link('doc-a', 'a1')])]);
    const { docs, changed } = stripMirrorLinks(mapOf(b), did('doc-a'), new Set(['a1']));
    expect(docs[did('doc-b')]?.entities.b1?.links).toBeUndefined();
    expect(changed).toHaveLength(1);
    expect(changed[0]?.id).toBe('doc-b');
  });

  it('keeps unrelated links and only strips the matching mirror', () => {
    const b = doc('doc-b', [entity('b1', [link('doc-a', 'a1'), link('doc-c', 'c1')])]);
    const { docs } = stripMirrorLinks(mapOf(b), did('doc-a'), new Set(['a1']));
    expect(docs[did('doc-b')]?.entities.b1?.links).toEqual([link('doc-c', 'c1')]);
  });

  it('never touches the doc the entities were deleted from', () => {
    // A (defensive) link living on the source doc must be left alone — the sweep
    // only cleans OTHER docs' back-links.
    const a = doc('doc-a', [entity('a2', [link('doc-a', 'a1')])]);
    const { docs, changed } = stripMirrorLinks(mapOf(a), did('doc-a'), new Set(['a1']));
    expect(docs[did('doc-a')]?.entities.a2?.links).toEqual([link('doc-a', 'a1')]);
    expect(changed).toHaveLength(0);
  });

  it('returns the same map reference and no changes when nothing matches', () => {
    const b = doc('doc-b', [entity('b1', [link('doc-c', 'c1')])]);
    const input = mapOf(b);
    const { docs, changed } = stripMirrorLinks(input, did('doc-a'), new Set(['a1']));
    expect(docs).toBe(input);
    expect(changed).toHaveLength(0);
  });

  it('is a no-op for an empty deleted set', () => {
    const b = doc('doc-b', [entity('b1', [link('doc-a', 'a1')])]);
    const input = mapOf(b);
    const { docs, changed } = stripMirrorLinks(input, did('doc-a'), new Set());
    expect(docs).toBe(input);
    expect(changed).toHaveLength(0);
  });

  it('sweeps mirrors across several docs for several deleted ids', () => {
    const b = doc('doc-b', [entity('b1', [link('doc-a', 'a1')])]);
    const c = doc('doc-c', [entity('c1', [link('doc-a', 'a2')])]);
    const { docs, changed } = stripMirrorLinks(mapOf(b, c), did('doc-a'), new Set(['a1', 'a2']));
    expect(docs[did('doc-b')]?.entities.b1?.links).toBeUndefined();
    expect(docs[did('doc-c')]?.entities.c1?.links).toBeUndefined();
    expect(changed).toHaveLength(2);
  });
});

describe('stripLinksToDoc', () => {
  it('removes every link pointing into the forgotten doc, dropping the empty field', () => {
    const a = doc('doc-a', [entity('a1', [link('doc-b', 'b1')])]);
    const { docs, changed } = stripLinksToDoc(mapOf(a), did('doc-b'));
    expect(docs[did('doc-a')]?.entities.a1?.links).toBeUndefined();
    expect(changed).toHaveLength(1);
  });

  it('keeps links that point into OTHER docs', () => {
    const a = doc('doc-a', [entity('a1', [link('doc-b', 'b1'), link('doc-c', 'c1')])]);
    const { docs } = stripLinksToDoc(mapOf(a), did('doc-b'));
    expect(docs[did('doc-a')]?.entities.a1?.links).toEqual([link('doc-c', 'c1')]);
  });

  it('returns the same map reference and no changes when nothing points into the doc', () => {
    const a = doc('doc-a', [entity('a1', [link('doc-c', 'c1')])]);
    const input = mapOf(a);
    const { docs, changed } = stripLinksToDoc(input, did('doc-b'));
    expect(docs).toBe(input);
    expect(changed).toHaveLength(0);
  });
});
