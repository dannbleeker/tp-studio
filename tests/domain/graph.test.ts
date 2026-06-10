import { beforeEach, describe, expect, it } from 'vitest';
import {
  assumptionsForEdge,
  connectionCount,
  entitiesByType,
  entitiesOfBuiltin,
  entitiesOfType,
  findCycles,
  findPath,
  hasEdge,
  incomingEdges,
  outgoingEdges,
  reachableBackward,
  reachableForward,
  removeEntityFromEdges,
  structuralEntities,
} from '@/domain/graph';
import type { Assumption, TPDocument } from '@/domain/types';
import { makeDoc, makeEdge, makeEntity, resetIds } from './helpers';

beforeEach(resetIds);

describe('assumptionsForEdge', () => {
  const mkAssumption = (id: string, edgeId: string): Assumption => ({
    id,
    edgeId,
    text: id,
    status: 'unexamined',
    createdAt: 1,
    updatedAt: 1,
  });

  it('groups the first-class assumption records by their host edge id', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const c = makeEntity({ title: 'C' });
    const e1 = makeEdge(a.id, b.id);
    const e2 = makeEdge(b.id, c.id);
    const doc: TPDocument = {
      ...makeDoc([a, b, c], [e1, e2]),
      assumptions: {
        a1: mkAssumption('a1', e1.id),
        a2: mkAssumption('a2', e1.id),
        a3: mkAssumption('a3', e2.id),
      },
    };
    expect(assumptionsForEdge(doc, e1.id).map((x) => x.id)).toEqual(['a1', 'a2']);
    expect(assumptionsForEdge(doc, e2.id).map((x) => x.id)).toEqual(['a3']);
  });

  it('returns a stable empty-array reference for an edge with no assumptions', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const e1 = makeEdge(a.id, b.id);
    const doc = makeDoc([a, b], [e1]); // no assumptions field at all
    const first = assumptionsForEdge(doc, e1.id);
    expect(first).toEqual([]);
    expect(assumptionsForEdge(doc, e1.id)).toBe(first); // same ref → memo-stable
  });

  it('memoises per doc.assumptions reference', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const e1 = makeEdge(a.id, b.id);
    const doc: TPDocument = {
      ...makeDoc([a, b], [e1]),
      assumptions: { a1: mkAssumption('a1', e1.id) },
    };
    expect(assumptionsForEdge(doc, e1.id)).toBe(assumptionsForEdge(doc, e1.id));
  });
});

describe('incomingEdges / outgoingEdges', () => {
  it('returns only edges that target / source the given entity', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const c = makeEntity({ title: 'C' });
    const ab = makeEdge(a.id, b.id);
    const cb = makeEdge(c.id, b.id);
    const doc = makeDoc([a, b, c], [ab, cb]);

    expect(incomingEdges(doc, b.id).map((e) => e.id)).toEqual([ab.id, cb.id]);
    expect(outgoingEdges(doc, a.id).map((e) => e.id)).toEqual([ab.id]);
    expect(incomingEdges(doc, a.id)).toEqual([]);
    expect(outgoingEdges(doc, b.id)).toEqual([]);
  });
});

describe('connectionCount', () => {
  it('returns the sum of incoming and outgoing', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const c = makeEntity({ title: 'C' });
    const ab = makeEdge(a.id, b.id);
    const bc = makeEdge(b.id, c.id);
    const doc = makeDoc([a, b, c], [ab, bc]);
    expect(connectionCount(doc, b.id)).toBe(2);
    expect(connectionCount(doc, a.id)).toBe(1);
  });

  it('returns 0 for a disconnected entity', () => {
    const a = makeEntity({ title: 'Lonely' });
    expect(connectionCount(makeDoc([a], []), a.id)).toBe(0);
  });
});

describe('hasEdge', () => {
  it('detects an existing edge by source/target', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const ab = makeEdge(a.id, b.id);
    const doc = makeDoc([a, b], [ab]);
    expect(hasEdge(doc, a.id, b.id)).toBe(true);
    expect(hasEdge(doc, b.id, a.id)).toBe(false);
  });
});

describe('entitiesByType / entitiesOfType', () => {
  it('groups entities by their type', () => {
    const u1 = makeEntity({ type: 'ude', title: 'UDE 1' });
    const u2 = makeEntity({ type: 'ude', title: 'UDE 2' });
    const eff = makeEntity({ type: 'effect', title: 'Effect' });
    const doc = makeDoc([u1, u2, eff], []);
    const byType = entitiesByType(doc);
    expect(byType.get('ude')?.map((e) => e.id)).toEqual([u1.id, u2.id]);
    expect(byType.get('effect')?.map((e) => e.id)).toEqual([eff.id]);
    // Types with no entities are absent from the map (not empty array).
    expect(byType.has('goal')).toBe(false);
  });

  it('entitiesOfType returns the typed array, empty when missing', () => {
    const u1 = makeEntity({ type: 'ude', title: 'UDE' });
    const doc = makeDoc([u1], []);
    expect(entitiesOfType(doc, 'ude').map((e) => e.id)).toEqual([u1.id]);
    expect(entitiesOfType(doc, 'goal')).toEqual([]);
  });

  it('returns the same empty array reference on every missing-type call', () => {
    // Stable empty result keeps `useShallow` / React.memo callers from
    // re-emitting on every doc state when a diagram has no entities of
    // the queried type.
    const doc = makeDoc([], []);
    expect(entitiesOfType(doc, 'goal')).toBe(entitiesOfType(doc, 'ude'));
  });

  it('caches per doc.entities reference', () => {
    const u1 = makeEntity({ type: 'ude', title: 'UDE' });
    const doc = makeDoc([u1], []);
    // Two calls against the same doc share the by-type map reference.
    expect(entitiesByType(doc)).toBe(entitiesByType(doc));
    expect(entitiesOfType(doc, 'ude')).toBe(entitiesOfType(doc, 'ude'));
  });

  it('rebuilds when the entities map gets a new reference', () => {
    const u1 = makeEntity({ type: 'ude', title: 'UDE' });
    const doc1 = makeDoc([u1], []);
    const cached = entitiesByType(doc1);
    // Simulate an immutable store update — same id, fresh entities map.
    const u1b = { ...u1, title: 'UDE renamed' };
    const doc2 = { ...doc1, entities: { [u1b.id]: u1b } };
    const fresh = entitiesByType(doc2);
    expect(fresh).not.toBe(cached);
    expect(fresh.get('ude')?.[0]?.title).toBe('UDE renamed');
  });
});

describe('structuralEntities', () => {
  it('filters out notes (the only non-causal entity type)', () => {
    const eff = makeEntity({ type: 'effect', title: 'E' });
    const note = makeEntity({ type: 'note', title: 'N' });
    const doc = makeDoc([eff, note], []);
    expect(structuralEntities(doc).map((e) => e.id)).toEqual([eff.id]);
  });
});

describe('removeEntityFromEdges', () => {
  it('drops edges that name the entity as source or target', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const c = makeEntity({ title: 'C' });
    const ab = makeEdge(a.id, b.id);
    const bc = makeEdge(b.id, c.id);
    const result = removeEntityFromEdges(makeDoc([a, b, c], [ab, bc]), b.id);
    expect(Object.keys(result)).toEqual([]);
  });

  it('keeps untouched edges intact', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const c = makeEntity({ title: 'C' });
    const ab = makeEdge(a.id, b.id);
    const result = removeEntityFromEdges(makeDoc([a, b, c], [ab]), c.id);
    expect(result[ab.id]).toBe(ab); // same reference — no copy when unaffected
  });

  // Record-canonical (v10): assumptions attach via the `doc.assumptions`
  // record's `edgeId`, not a now-removed `edge.assumptionIds` index, and
  // they aren't entities — so `removeEntityFromEdges` no longer scrubs
  // anything assumption-related (orphan records are pruned separately by
  // `pruneAssumptions`). The old per-edge scrub assertions are obsolete.
});

describe('reachableForward / reachableBackward', () => {
  it('forward walks all downstream entities', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const c = makeEntity({ title: 'C' });
    const d = makeEntity({ title: 'D' });
    const ab = makeEdge(a.id, b.id);
    const bc = makeEdge(b.id, c.id);
    const doc = makeDoc([a, b, c, d], [ab, bc]);
    expect([...reachableForward(doc, [a.id])].sort()).toEqual([b.id, c.id].sort());
    expect(reachableForward(doc, [d.id]).size).toBe(0);
  });

  it('backward walks all upstream entities', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const c = makeEntity({ title: 'C' });
    const ab = makeEdge(a.id, b.id);
    const bc = makeEdge(b.id, c.id);
    const doc = makeDoc([a, b, c], [ab, bc]);
    expect([...reachableBackward(doc, [c.id])].sort()).toEqual([a.id, b.id].sort());
  });

  it('handles cycles without infinite-looping', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const ab = makeEdge(a.id, b.id);
    const ba = makeEdge(b.id, a.id);
    const doc = makeDoc([a, b], [ab, ba]);
    expect([...reachableForward(doc, [a.id])].sort()).toEqual([a.id, b.id].sort());
  });
});

describe('findPath', () => {
  it('returns the directed shortest path', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const c = makeEntity({ title: 'C' });
    const d = makeEntity({ title: 'D' });
    const ab = makeEdge(a.id, b.id);
    const bc = makeEdge(b.id, c.id);
    const cd = makeEdge(c.id, d.id);
    const doc = makeDoc([a, b, c, d], [ab, bc, cd]);
    const path = findPath(doc, a.id, d.id);
    expect(path?.entityIds).toEqual([a.id, b.id, c.id, d.id]);
    expect(path?.edgeIds).toEqual([ab.id, bc.id, cd.id]);
  });

  it('falls back to undirected when no directed path exists', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const ab = makeEdge(a.id, b.id);
    const doc = makeDoc([a, b], [ab]);
    const path = findPath(doc, b.id, a.id);
    expect(path?.entityIds).toEqual([b.id, a.id]);
  });

  it('returns null for disconnected entities', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const doc = makeDoc([a, b], []);
    expect(findPath(doc, a.id, b.id)).toBeNull();
  });

  it('returns a length-1 path for fromId === toId', () => {
    const a = makeEntity({ title: 'A' });
    const doc = makeDoc([a], []);
    expect(findPath(doc, a.id, a.id)).toEqual({ entityIds: [a.id], edgeIds: [] });
  });
});

describe('findCycles', () => {
  it('returns an empty array for an acyclic graph', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const c = makeEntity({ title: 'C' });
    const doc = makeDoc([a, b, c], [makeEdge(a.id, b.id), makeEdge(b.id, c.id)]);
    expect(findCycles(doc)).toEqual([]);
  });

  it('detects a simple two-node cycle', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const doc = makeDoc([a, b], [makeEdge(a.id, b.id), makeEdge(b.id, a.id)]);
    const cycles = findCycles(doc);
    expect(cycles).toHaveLength(1);
    expect(cycles[0]).toHaveLength(2);
    expect(cycles[0]).toContain(a.id);
    expect(cycles[0]).toContain(b.id);
  });

  it('detects a three-node cycle and reports it once regardless of start', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const c = makeEntity({ title: 'C' });
    const doc = makeDoc(
      [a, b, c],
      [makeEdge(a.id, b.id), makeEdge(b.id, c.id), makeEdge(c.id, a.id)]
    );
    const cycles = findCycles(doc);
    // Canonicalization deduplicates rotations of the same cycle.
    expect(cycles).toHaveLength(1);
    expect(cycles[0]).toHaveLength(3);
  });

  it('detects two independent cycles in the same doc', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const c = makeEntity({ title: 'C' });
    const d = makeEntity({ title: 'D' });
    const doc = makeDoc(
      [a, b, c, d],
      [makeEdge(a.id, b.id), makeEdge(b.id, a.id), makeEdge(c.id, d.id), makeEdge(d.id, c.id)]
    );
    expect(findCycles(doc)).toHaveLength(2);
  });

  it('does not consider a self-acyclic A→B→C with B→A as no cycle', () => {
    // Sanity guard against a regression where the DFS forgets to clear
    // `onStack` after backtracking. The forward chain itself shouldn't
    // produce a phantom cycle.
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const c = makeEntity({ title: 'C' });
    const doc = makeDoc(
      [a, b, c],
      [makeEdge(a.id, b.id), makeEdge(b.id, c.id), makeEdge(b.id, a.id)]
    );
    const cycles = findCycles(doc);
    // Only the A↔B cycle; the A→B→C arm doesn't add a cycle.
    expect(cycles).toHaveLength(1);
  });
});

describe('entitiesOfBuiltin', () => {
  const CLASSES = {
    'site-risk': { id: 'site-risk', label: 'Site Risk', supersetOf: 'ude' as const },
  };

  it('matches raw builtin types AND custom classes with a matching supersetOf', () => {
    const plain = makeEntity({ type: 'ude', title: 'Plain' });
    const custom = makeEntity({ type: 'site-risk' as never, title: 'Custom' });
    const other = makeEntity({ type: 'effect', title: 'Other' });
    const doc = { ...makeDoc([plain, custom, other], []), customEntityClasses: CLASSES };
    expect(
      entitiesOfBuiltin(doc, 'ude')
        .map((e) => e.id)
        .sort()
    ).toEqual([plain.id, custom.id].sort());
  });

  it('returns a referentially-stable array per (entities, classes) state', () => {
    const a = makeEntity({ type: 'ude', title: 'A' });
    const doc = { ...makeDoc([a], []), customEntityClasses: CLASSES };
    expect(entitiesOfBuiltin(doc, 'ude')).toBe(entitiesOfBuiltin(doc, 'ude'));
  });

  it('re-derives when only the classes map changes (same entities reference)', () => {
    const custom = makeEntity({ type: 'site-risk' as never, title: 'Custom' });
    const asUde = { ...makeDoc([custom], []), customEntityClasses: CLASSES };
    const asEffect = {
      ...asUde,
      customEntityClasses: {
        'site-risk': { id: 'site-risk', label: 'Site Risk', supersetOf: 'effect' as const },
      },
    };
    expect(asEffect.entities).toBe(asUde.entities);
    expect(entitiesOfBuiltin(asUde, 'ude')).toHaveLength(1);
    expect(entitiesOfBuiltin(asEffect, 'ude')).toHaveLength(0);
    expect(entitiesOfBuiltin(asEffect, 'effect')).toHaveLength(1);
  });
});
