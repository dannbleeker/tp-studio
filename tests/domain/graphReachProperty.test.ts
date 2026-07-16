import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { findCycles } from '@/domain/graphReach';
import type { TPDocument } from '@/domain/types';
import { makeDoc, makeEdge, makeEntity, resetIds } from './helpers';

/**
 * Session 206 — differential test for the Tarjan-SCC + Johnson rewrite of
 * `findCycles`.
 *
 * Swapping in a non-obvious algorithm deserves more than a handful of shaped
 * examples: the defect it replaced (a DFS that reported a cycle BASIS rather
 * than every elementary circuit) passed every test the repo had. So here the
 * optimised implementation is checked against a deliberately naive reference —
 * exhaustive simple-path enumeration — over random small graphs. The reference
 * is exponential and unfit for production, but it is obviously correct, which is
 * exactly what a differential oracle needs to be.
 */

/**
 * Brute-force every elementary circuit: from each start `s`, walk all simple
 * paths that use only nodes ordered at or after `s`, recording each return to
 * `s`. Restricting to `>= s` is what makes every circuit surface exactly once —
 * when `s` is its minimum — so the output is directly comparable.
 */
const bruteForceCycles = (nodes: string[], edges: [string, string][]): string[][] => {
  const order = [...nodes].sort();
  const adj = new Map<string, string[]>();
  for (const n of order) adj.set(n, []);
  for (const [from, to] of edges) {
    const list = adj.get(from);
    if (list && !list.includes(to)) list.push(to);
  }
  const found: string[][] = [];
  for (let i = 0; i < order.length; i++) {
    const root = order[i];
    if (root === undefined) continue;
    const allowed = new Set(order.slice(i));
    const path: string[] = [];
    const onPath = new Set<string>();
    const walk = (v: string): void => {
      path.push(v);
      onPath.add(v);
      for (const w of adj.get(v) ?? []) {
        if (!allowed.has(w)) continue;
        if (w === root) found.push([...path]);
        else if (!onPath.has(w)) walk(w);
      }
      path.pop();
      onPath.delete(v);
    };
    walk(root);
  }
  return found;
};

/** Order-insensitive comparison key for a set of cycles. */
const key = (cycles: string[][]): string[] => cycles.map((c) => c.join('>')).sort();

const docOf = (nodeCount: number, pairs: [number, number][]): TPDocument => {
  resetIds();
  const entities = Array.from({ length: nodeCount }, (_, i) =>
    makeEntity({ type: 'effect', title: `N${i}` })
  );
  const edges = pairs
    .filter(([a, b]) => a < nodeCount && b < nodeCount)
    .map(([a, b]) => makeEdge(entities[a]!.id, entities[b]!.id));
  return makeDoc(entities, edges, 'crt');
};

describe('findCycles — differential vs brute force', () => {
  it('matches exhaustive enumeration on random small digraphs', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 6 }),
        fc.array(fc.tuple(fc.integer({ min: 0, max: 5 }), fc.integer({ min: 0, max: 5 })), {
          maxLength: 14,
        }),
        (nodeCount, pairs) => {
          const doc = docOf(nodeCount, pairs as [number, number][]);
          const nodes = Object.keys(doc.entities);
          const edgeList = Object.values(doc.edges).map(
            (e) => [e.sourceId, e.targetId] as [string, string]
          );
          expect(key(findCycles(doc))).toEqual(key(bruteForceCycles(nodes, edgeList)));
        }
      ),
      { numRuns: 300 }
    );
  });

  it('matches brute force on a dense 5-node graph (many overlapping circuits)', () => {
    // Every ordered pair except self-loops — the worst realistic case for
    // completeness, and the shape a basis-only walk gets most wrong.
    const pairs: [number, number][] = [];
    for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) if (a !== b) pairs.push([a, b]);
    const doc = docOf(5, pairs);
    const nodes = Object.keys(doc.entities);
    const edgeList = Object.values(doc.edges).map(
      (e) => [e.sourceId, e.targetId] as [string, string]
    );
    const mine = findCycles(doc);
    // A complete digraph on 5 nodes has 84 elementary circuits.
    expect(mine).toHaveLength(84);
    expect(key(mine)).toEqual(key(bruteForceCycles(nodes, edgeList)));
  });
});
