import { beforeEach, describe, expect, it } from 'vitest';
import { findCycles, findPath } from '@/domain/graphReach';
import type { TPDocument } from '@/domain/types';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../helpers/seedDoc';
import { makeDoc, makeEdge, makeEntity, resetIds } from './helpers';

beforeEach(resetStoreForTest);
const s = () => useDocumentStore.getState();

describe('findCycles', () => {
  it('returns no cycles for an acyclic graph', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    s().connect(a.id, b.id);
    expect(findCycles(s().doc)).toEqual([]);
  });

  it('detects a directed cycle over its three members', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const c = seedEntity('C');
    s().connect(a.id, b.id);
    s().connect(b.id, c.id);
    s().connect(c.id, a.id); // closes A → B → C → A
    const cycles = findCycles(s().doc);
    expect(cycles).toHaveLength(1);
    expect(new Set(cycles[0])).toEqual(new Set([a.id, b.id, c.id]));
  });

  it('memoises on the edge-set reference (same array on a repeat call)', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    s().connect(a.id, b.id);
    const doc = s().doc;
    expect(findCycles(doc)).toBe(findCycles(doc)); // WeakMap cache hit
  });

  // Session 206 — the Session-205 hunt's recorded defect. The old DFS marked
  // nodes `visited` globally and never unmarked them, so it reported a cycle
  // BASIS rather than every elementary circuit: a second loop arriving at an
  // already-finished node found nothing on the recursion stack and was dropped.
  // Now Tarjan SCC + Johnson, which is complete by construction.
  const asSets = (cycles: string[][]) => cycles.map((c) => new Set(c));

  it('reports BOTH loops when two cycles share a closing edge', () => {
    // A→B→C→A and A→D→C→A — both close through C→A.
    const a = seedEntity('A');
    const b = seedEntity('B');
    const c = seedEntity('C');
    const d = seedEntity('D');
    s().connect(a.id, b.id);
    s().connect(b.id, c.id);
    s().connect(a.id, d.id);
    s().connect(d.id, c.id);
    s().connect(c.id, a.id); // the shared closer
    const cycles = findCycles(s().doc);
    // Pre-fix only ONE of these came back.
    expect(cycles).toHaveLength(2);
    expect(asSets(cycles)).toEqual(
      expect.arrayContaining([new Set([a.id, b.id, c.id]), new Set([a.id, d.id, c.id])])
    );
  });

  it('reports both loops of a figure-eight sharing one hub node', () => {
    // A→B→A and A→C→A — two 2-cycles meeting at A.
    const a = seedEntity('A');
    const b = seedEntity('B');
    const c = seedEntity('C');
    s().connect(a.id, b.id);
    s().connect(b.id, a.id);
    s().connect(a.id, c.id);
    s().connect(c.id, a.id);
    expect(asSets(findCycles(s().doc))).toEqual(
      expect.arrayContaining([new Set([a.id, b.id]), new Set([a.id, c.id])])
    );
    expect(findCycles(s().doc)).toHaveLength(2);
  });

  it('reports the inner and outer loop of a nested cycle', () => {
    // Outer A→B→C→D→A, inner shortcut C→A gives A→B→C→A as well.
    const a = seedEntity('A');
    const b = seedEntity('B');
    const c = seedEntity('C');
    const d = seedEntity('D');
    s().connect(a.id, b.id);
    s().connect(b.id, c.id);
    s().connect(c.id, d.id);
    s().connect(d.id, a.id);
    s().connect(c.id, a.id);
    const cycles = findCycles(s().doc);
    expect(cycles).toHaveLength(2);
    expect(asSets(cycles)).toEqual(
      expect.arrayContaining([new Set([a.id, b.id, c.id, d.id]), new Set([a.id, b.id, c.id])])
    );
  });

  it('still reports a self-loop as a one-entity cycle', () => {
    // Built as a raw doc, not via `connect` — the store rejects self-loops
    // (`connect.ts:69`), but `importFromJSON` accepts one, so a hand-edited
    // file / share link / Flying Logic import can still hand us this shape.
    resetIds();
    const a = makeEntity({ type: 'effect', title: 'A' });
    const doc = makeDoc([a], [makeEdge(a.id, a.id)], 'crt');
    expect(findCycles(doc)).toEqual([[a.id]]);
  });

  it('keeps two disjoint cycles separate', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const c = seedEntity('C');
    const d = seedEntity('D');
    s().connect(a.id, b.id);
    s().connect(b.id, a.id);
    s().connect(c.id, d.id);
    s().connect(d.id, c.id);
    expect(asSets(findCycles(s().doc))).toEqual(
      expect.arrayContaining([new Set([a.id, b.id]), new Set([c.id, d.id])])
    );
    expect(findCycles(s().doc)).toHaveLength(2);
  });

  it('rotates every cycle to start at its smallest id (backEdges depends on it)', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const c = seedEntity('C');
    s().connect(a.id, b.id);
    s().connect(b.id, c.id);
    s().connect(c.id, a.id);
    for (const cycle of findCycles(s().doc)) {
      const min = [...cycle].sort()[0];
      expect(cycle[0]).toBe(min);
    }
  });

  it('does not double-report a cycle when a parallel edge duplicates a hop', () => {
    // Two A→B edges: a cycle is a sequence of ENTITIES, so this is still ONE loop.
    const a = seedEntity('A');
    const b = seedEntity('B');
    s().connect(a.id, b.id);
    s().connect(a.id, b.id);
    s().connect(b.id, a.id);
    expect(findCycles(s().doc)).toHaveLength(1);
  });
});

describe('findPath', () => {
  it('finds a route across a diamond, skipping the already-visited join node', () => {
    // A → B, A → C, B → D, C → D — two routes converge on D.
    const a = seedEntity('A');
    const b = seedEntity('B');
    const c = seedEntity('C');
    const d = seedEntity('D');
    s().connect(a.id, b.id);
    s().connect(a.id, c.id);
    s().connect(b.id, d.id);
    s().connect(c.id, d.id);
    const path = findPath(s().doc, a.id, d.id);
    expect(path).not.toBeNull();
    expect(path?.entityIds[0]).toBe(a.id);
    expect(path?.entityIds.at(-1)).toBe(d.id);
  });

  it('returns null when neither a directed nor an undirected route exists', () => {
    const a = seedEntity('A');
    const b = seedEntity('B'); // no edge between them
    expect(findPath(s().doc, a.id, b.id)).toBeNull();
  });
});

/**
 * Session 209 — `findCycles` ran a full Tarjan pass per vertex (O(V·(V+E))) and
 * used a recursive `strongConnect`, so a plain acyclic chain cost 11.7 s at
 * n=7000 and threw `RangeError: Maximum call stack size exceeded` at n=9000.
 * It re-runs on every `doc.edges` change and feeds the canvas via
 * `effectiveBackEdgeIds`, so the throw killed the render.
 *
 * The sizes here are far past anything a hand-built tree reaches; that is the
 * point — they fail loudly and fast if either property regresses, and they run
 * in milliseconds now that an acyclic graph short-circuits after one SCC pass.
 */
describe('findCycles scales and does not overflow the stack', () => {
  const chain = (n: number): TPDocument => {
    const entities = Array.from({ length: n }, (_, i) =>
      makeEntity({ id: `n${i}` as never, annotationNumber: i + 1 })
    );
    const edges = Array.from({ length: n - 1 }, (_, i) =>
      makeEdge(`n${i}` as never, `n${i + 1}` as never)
    );
    return makeDoc(entities, edges);
  };

  it('returns no cycles for a 9000-node acyclic chain without throwing', () => {
    expect(findCycles(chain(9000))).toEqual([]);
  });

  it('still finds a cycle closed at the end of a long chain', () => {
    const doc = chain(4000);
    const withBackEdge = {
      ...doc,
      edges: { ...doc.edges, back: makeEdge('n3999' as never, 'n0' as never) },
    };
    const cycles = findCycles(withBackEdge);
    expect(cycles).toHaveLength(1);
    expect(cycles[0]?.[0]).toBe('n0');
    expect(cycles[0]).toHaveLength(4000);
  });
});
