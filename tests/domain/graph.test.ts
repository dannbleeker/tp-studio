import {
  connectionCount,
  findCycles,
  findPath,
  hasEdge,
  incomingEdges,
  isAssumption,
  outgoingEdges,
  reachableBackward,
  reachableForward,
  removeEntityFromEdges,
  structuralEntities,
} from '@/domain/graph';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeDoc, makeEdge, makeEntity, resetIds } from './helpers';

beforeEach(resetIds);

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

describe('isAssumption / structuralEntities', () => {
  it('isAssumption is a pure predicate on entity.type', () => {
    expect(isAssumption(makeEntity({ type: 'assumption' }))).toBe(true);
    expect(isAssumption(makeEntity({ type: 'effect' }))).toBe(false);
  });

  it('structuralEntities filters out assumptions', () => {
    const eff = makeEntity({ type: 'effect', title: 'E' });
    const ass = makeEntity({ type: 'assumption', title: 'A' });
    const doc = makeDoc([eff, ass], []);
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

  it('scrubs the id from assumptionIds on surviving edges', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const assumption = makeEntity({ type: 'assumption', title: 'Assumption' });
    const ab = makeEdge(a.id, b.id, { assumptionIds: [assumption.id] });
    const result = removeEntityFromEdges(makeDoc([a, b, assumption], [ab]), assumption.id);
    expect(result[ab.id]).toBeDefined();
    expect(result[ab.id]!.assumptionIds).toBeUndefined();
  });

  it('preserves other assumption ids when only one is removed', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const ass1 = makeEntity({ type: 'assumption', title: 'A1' });
    const ass2 = makeEntity({ type: 'assumption', title: 'A2' });
    const ab = makeEdge(a.id, b.id, { assumptionIds: [ass1.id, ass2.id] });
    const result = removeEntityFromEdges(makeDoc([a, b, ass1, ass2], [ab]), ass1.id);
    expect(result[ab.id]!.assumptionIds).toEqual([ass2.id]);
  });
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
