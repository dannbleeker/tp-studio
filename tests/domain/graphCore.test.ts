import { beforeEach, describe, expect, it } from 'vitest';
import {
  assumptionsForEdge,
  connectionCount,
  edgeIndex,
  edgesArray,
  entitiesArray,
  entitiesOfType,
  getEntity,
  hasEdge,
  incomingEdges,
  isNonCausal,
  isNote,
  isStNodeFormat,
  junctorGroupId,
  outgoingEdges,
  pinnedEntities,
  structuralEntities,
} from '@/domain/graphCore';
import type { Assumption, TPDocument } from '@/domain/types';
import { makeDoc, makeEdge, makeEntity, resetIds } from './helpers';

beforeEach(resetIds);

describe('edgesArray / entitiesArray — cached materialization', () => {
  it('returns every edge / entity and an empty array on an empty doc', () => {
    const empty = makeDoc([], []);
    expect(edgesArray(empty)).toHaveLength(0);
    expect(entitiesArray(empty)).toHaveLength(0);

    const a = makeEntity();
    const b = makeEntity();
    const doc = makeDoc([a, b], [makeEdge(a.id, b.id)]);
    expect(
      entitiesArray(doc)
        .map((e) => e.id)
        .sort()
    ).toEqual([a.id, b.id].sort());
    expect(edgesArray(doc)).toHaveLength(1);
  });

  it('returns the SAME array reference for the same doc (WeakMap cache hit)', () => {
    const a = makeEntity();
    const doc = makeDoc([a], []);
    expect(edgesArray(doc)).toBe(edgesArray(doc));
    expect(entitiesArray(doc)).toBe(entitiesArray(doc));
  });

  it('rebuilds when the edges / entities map gets a new reference', () => {
    const a = makeEntity();
    const b = makeEntity();
    const doc = makeDoc([a, b], [makeEdge(a.id, b.id)]);
    const first = edgesArray(doc);
    const doc2: TPDocument = {
      ...doc,
      edges: { ...doc.edges, [makeEdge(b.id, a.id).id]: makeEdge(b.id, a.id) },
    };
    expect(edgesArray(doc2)).not.toBe(first);
    expect(edgesArray(doc2)).toHaveLength(2);
  });
});

describe('junctorGroupId', () => {
  it('is undefined for a plain edge', () => {
    expect(junctorGroupId({})).toBeUndefined();
  });

  it('returns the set group id', () => {
    expect(junctorGroupId({ andGroupId: 'g1' })).toBe('g1');
    expect(junctorGroupId({ orGroupId: 'g2' })).toBe('g2');
    expect(junctorGroupId({ xorGroupId: 'g3' })).toBe('g3');
  });

  it('prefers and > or > xor when (defensively) more than one is set', () => {
    expect(junctorGroupId({ andGroupId: 'a', orGroupId: 'o', xorGroupId: 'x' })).toBe('a');
    expect(junctorGroupId({ orGroupId: 'o', xorGroupId: 'x' })).toBe('o');
  });
});

describe('edge index — incoming / outgoing / connectionCount / hasEdge', () => {
  it('separates incoming from outgoing', () => {
    const a = makeEntity();
    const b = makeEntity();
    const c = makeEntity();
    const doc = makeDoc([a, b, c], [makeEdge(a.id, b.id), makeEdge(c.id, b.id)]);
    expect(outgoingEdges(doc, a.id)).toHaveLength(1);
    expect(incomingEdges(doc, a.id)).toHaveLength(0);
    expect(incomingEdges(doc, b.id)).toHaveLength(2);
    expect(outgoingEdges(doc, b.id)).toHaveLength(0);
    expect(connectionCount(doc, b.id)).toBe(2);
  });

  it('counts a self-loop edge on BOTH the in and out side', () => {
    const a = makeEntity();
    const doc = makeDoc([a], [makeEdge(a.id, a.id)]);
    expect(incomingEdges(doc, a.id)).toHaveLength(1);
    expect(outgoingEdges(doc, a.id)).toHaveLength(1);
    // The same loop edge shows up on both ends, so connectionCount is 2.
    expect(connectionCount(doc, a.id)).toBe(2);
    expect(hasEdge(doc, a.id, a.id)).toBe(true);
  });

  it('returns a stable empty-array reference for an unconnected node', () => {
    const a = makeEntity();
    const b = makeEntity();
    const doc = makeDoc([a, b], []);
    expect(incomingEdges(doc, a.id)).toHaveLength(0);
    expect(incomingEdges(doc, a.id)).toBe(outgoingEdges(doc, b.id)); // same frozen sentinel
    expect(connectionCount(doc, a.id)).toBe(0);
  });

  it('hasEdge is direction-sensitive and false for a missing edge', () => {
    const a = makeEntity();
    const b = makeEntity();
    const doc = makeDoc([a, b], [makeEdge(a.id, b.id)]);
    expect(hasEdge(doc, a.id, b.id)).toBe(true);
    expect(hasEdge(doc, b.id, a.id)).toBe(false);
  });

  it('caches the index on the same doc.edges reference', () => {
    const a = makeEntity();
    const doc = makeDoc([a], []);
    expect(edgeIndex(doc)).toBe(edgeIndex(doc));
  });
});

describe('entity predicates + by-type lookups', () => {
  it('isNote / isNonCausal are true only for note entities', () => {
    expect(isNote(makeEntity({ type: 'note' }))).toBe(true);
    expect(isNote(makeEntity({ type: 'effect' }))).toBe(false);
    expect(isNonCausal(makeEntity({ type: 'note' }))).toBe(true);
    expect(isNonCausal(makeEntity({ type: 'ude' }))).toBe(false);
  });

  it('entitiesByType groups by type and entitiesOfType reads a group', () => {
    const e1 = makeEntity({ type: 'effect' });
    const e2 = makeEntity({ type: 'effect' });
    const u1 = makeEntity({ type: 'ude' });
    const doc = makeDoc([e1, e2, u1], []);
    expect(entitiesOfType(doc, 'effect')).toHaveLength(2);
    expect(entitiesOfType(doc, 'ude')).toHaveLength(1);
  });

  it('entitiesOfType returns the SAME frozen empty reference for an absent type', () => {
    const doc = makeDoc([makeEntity({ type: 'effect' })], []);
    expect(entitiesOfType(doc, 'ude')).toHaveLength(0);
    expect(entitiesOfType(doc, 'ude')).toBe(entitiesOfType(doc, 'injection')); // shared sentinel
  });

  it('structuralEntities excludes notes and is cached per doc reference', () => {
    const e = makeEntity({ type: 'effect' });
    const n = makeEntity({ type: 'note' });
    const doc = makeDoc([e, n], []);
    const structural = structuralEntities(doc);
    expect(structural.map((x) => x.id)).toEqual([e.id]);
    expect(structuralEntities(doc)).toBe(structural); // cache hit
  });

  it('getEntity finds by id and returns undefined for a missing id', () => {
    const a = makeEntity();
    const doc = makeDoc([a], []);
    expect(getEntity(doc, a.id)).toBe(a);
    expect(getEntity(doc, 'nope')).toBeUndefined();
  });

  it('pinnedEntities returns only entities carrying a stored position', () => {
    const free = makeEntity();
    const pinned = makeEntity({ position: { x: 10, y: 20 } });
    const doc = makeDoc([free, pinned], []);
    expect(pinnedEntities(doc).map((e) => e.id)).toEqual([pinned.id]);
  });
});

describe('isStNodeFormat', () => {
  const facet = { stStrategy: { kind: 'string', value: 'win' } } as const;

  it('is true for an injection carrying any S&T facet attribute', () => {
    expect(isStNodeFormat(makeEntity({ type: 'injection', attributes: { ...facet } }))).toBe(true);
  });

  it('is false for an injection with no attributes / only non-facet attributes', () => {
    expect(isStNodeFormat(makeEntity({ type: 'injection' }))).toBe(false);
    expect(
      isStNodeFormat(
        makeEntity({ type: 'injection', attributes: { foo: { kind: 'string', value: 'x' } } })
      )
    ).toBe(false);
  });

  it('is false for a non-injection entity even with a facet attribute set', () => {
    expect(isStNodeFormat(makeEntity({ type: 'effect', attributes: { ...facet } }))).toBe(false);
    expect(isStNodeFormat(makeEntity({ type: 'note', attributes: { ...facet } }))).toBe(false);
  });
});

describe('assumptionsForEdge', () => {
  it('returns a stable empty reference when the doc has no assumptions', () => {
    const a = makeEntity();
    const b = makeEntity();
    const e = makeEdge(a.id, b.id);
    const doc = makeDoc([a, b], [e]);
    expect(assumptionsForEdge(doc, e.id)).toHaveLength(0);
    expect(assumptionsForEdge(doc, e.id)).toBe(assumptionsForEdge(doc, 'whatever')); // shared sentinel
  });

  it('groups assumption records by their host edgeId', () => {
    const a = makeEntity();
    const b = makeEntity();
    const e1 = makeEdge(a.id, b.id);
    const e2 = makeEdge(b.id, a.id);
    const mk = (id: string, edgeId: string): Assumption => ({
      id,
      edgeId,
      text: `note ${id}`,
      status: 'unexamined',
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
    });
    const doc: TPDocument = {
      ...makeDoc([a, b], [e1, e2]),
      assumptions: { x: mk('x', e1.id), y: mk('y', e1.id), z: mk('z', e2.id) },
    };
    expect(
      assumptionsForEdge(doc, e1.id)
        .map((r) => r.id)
        .sort()
    ).toEqual(['x', 'y']);
    expect(assumptionsForEdge(doc, e2.id).map((r) => r.id)).toEqual(['z']);
    expect(assumptionsForEdge(doc, 'unconnected')).toHaveLength(0);
  });
});
