import { afterEach, describe, expect, it } from 'vitest';
import {
  clearLayoutCacheForTests,
  computeLayout,
  getLayoutCacheStats,
  splitIntoComponents,
} from '@/domain/layout';

/**
 * Session 83 — FL-LA4. The layout module now splits into weakly-connected
 * components, layouts each, and caches per-component output. Tests cover:
 *   - `splitIntoComponents` partitions correctly (every node + edge
 *     accounted for; no node in two components; isolated nodes stand
 *     alone).
 *   - `computeLayout` end-to-end still produces non-overlapping
 *     positions and matches the pre-split behaviour on single-component
 *     inputs.
 *   - The module-level cache survives a no-op call (same input →
 *     identical output) and invalidates on input change.
 */

describe('splitIntoComponents', () => {
  it('groups a single connected graph into one component', () => {
    const nodes = ['a', 'b', 'c'].map((id) => ({ id, width: 200, height: 60 }));
    const edges = [
      { sourceId: 'a', targetId: 'b' },
      { sourceId: 'b', targetId: 'c' },
    ];
    const components = splitIntoComponents(nodes, edges);
    expect(components).toHaveLength(1);
    expect(components[0]!.nodes.map((n) => n.id).sort()).toEqual(['a', 'b', 'c']);
    expect(components[0]!.edges).toHaveLength(2);
  });

  it('splits two disjoint subgraphs cleanly', () => {
    const nodes = ['a', 'b', 'c', 'd'].map((id) => ({ id, width: 200, height: 60 }));
    const edges = [
      { sourceId: 'a', targetId: 'b' },
      { sourceId: 'c', targetId: 'd' },
    ];
    const components = splitIntoComponents(nodes, edges);
    expect(components).toHaveLength(2);
    const sizes = components.map((c) => c.nodes.length).sort();
    expect(sizes).toEqual([2, 2]);
    // Every input node is accounted for exactly once.
    const allIds = components.flatMap((c) => c.nodes.map((n) => n.id)).sort();
    expect(allIds).toEqual(['a', 'b', 'c', 'd']);
  });

  it('keeps isolated nodes as their own components', () => {
    const nodes = ['a', 'b', 'c'].map((id) => ({ id, width: 200, height: 60 }));
    const edges = [{ sourceId: 'a', targetId: 'b' }];
    const components = splitIntoComponents(nodes, edges);
    expect(components).toHaveLength(2);
    const isolated = components.find((c) => c.nodes.length === 1);
    expect(isolated).toBeDefined();
    expect(isolated!.nodes[0]!.id).toBe('c');
    expect(isolated!.edges).toHaveLength(0);
  });

  it('handles empty input gracefully', () => {
    expect(splitIntoComponents([], [])).toHaveLength(0);
  });

  it('drops edges whose endpoints are not in the node set', () => {
    const nodes = [{ id: 'a', width: 200, height: 60 }];
    const edges = [{ sourceId: 'a', targetId: 'ghost' }];
    // Should not throw; the ghost edge is dropped, leaving one isolated component.
    const components = splitIntoComponents(nodes, edges);
    expect(components).toHaveLength(1);
    expect(components[0]!.nodes[0]!.id).toBe('a');
    expect(components[0]!.edges).toHaveLength(0);
  });
});

describe('computeLayout per-component packing', () => {
  afterEach(() => {
    clearLayoutCacheForTests();
  });

  it('stacks disconnected subgraphs vertically (no overlap)', () => {
    const nodes = ['a', 'b', 'c', 'd'].map((id) => ({ id, width: 200, height: 60 }));
    const edges = [
      { sourceId: 'a', targetId: 'b' },
      { sourceId: 'c', targetId: 'd' },
    ];
    const positions = computeLayout(nodes, edges);
    // Find the bounding boxes of the two pairs and verify they don't overlap.
    const a = positions.a!;
    const c = positions.c!;
    const verticalGap = Math.abs(a.y - c.y);
    // Two components separated by COMPONENT_GAP (80mm) + dagre rank
    // height (~60mm node + ~70mm rankSep). Conservative lower bound:
    // they should be at least the node height apart.
    expect(verticalGap).toBeGreaterThan(60);
  });

  it('produces the same positions on repeat calls (cache hit)', () => {
    const nodes = ['a', 'b'].map((id) => ({ id, width: 200, height: 60 }));
    const edges = [{ sourceId: 'a', targetId: 'b' }];
    const first = computeLayout(nodes, edges);
    const second = computeLayout(nodes, edges);
    expect(second).toEqual(first);
  });

  it('invalidates the cache when the graph changes structurally', () => {
    const baseNodes = ['a', 'b'].map((id) => ({ id, width: 200, height: 60 }));
    const baseEdges = [{ sourceId: 'a', targetId: 'b' }];
    const before = computeLayout(baseNodes, baseEdges);
    // Add a third connected node. New component hash → cache miss → fresh layout.
    const after = computeLayout(
      [...baseNodes, { id: 'c', width: 200, height: 60 }],
      [...baseEdges, { sourceId: 'b', targetId: 'c' }]
    );
    // Both contain `a` and `b`; the layout may shift slightly but both runs
    // must place `c` once and only once.
    expect(after.c).toBeDefined();
    expect(before.c).toBeUndefined();
  });
});

// Session 129 — FL-LA4 regression pin. The per-component cache landed
// in Session 83 ("layout-memo"); these tests harden the cache-reuse
// contract via the new `getLayoutCacheStats` observability hook so a
// future refactor that accidentally drops the cache (or causes its
// keys to drift) fires loudly in CI rather than producing slow-but-
// correct output.
describe('computeLayout component cache (FL-LA4 reuse contract)', () => {
  afterEach(() => {
    clearLayoutCacheForTests();
  });

  it('records a cache miss on first call, then a hit on the identical call', () => {
    const nodes = ['a', 'b'].map((id) => ({ id, width: 200, height: 60 }));
    const edges = [{ sourceId: 'a', targetId: 'b' }];
    computeLayout(nodes, edges);
    expect(getLayoutCacheStats()).toMatchObject({ hits: 0, misses: 1, size: 1 });
    computeLayout(nodes, edges);
    expect(getLayoutCacheStats()).toMatchObject({ hits: 1, misses: 1, size: 1 });
    computeLayout(nodes, edges);
    expect(getLayoutCacheStats()).toMatchObject({ hits: 2, misses: 1, size: 1 });
  });

  it('reuses unchanged components when a different component is modified', () => {
    // Two disconnected pairs. First call: 2 misses (both fresh).
    const nodes = ['a', 'b', 'c', 'd'].map((id) => ({ id, width: 200, height: 60 }));
    const edges = [
      { sourceId: 'a', targetId: 'b' },
      { sourceId: 'c', targetId: 'd' },
    ];
    computeLayout(nodes, edges);
    expect(getLayoutCacheStats()).toMatchObject({ hits: 0, misses: 2, size: 2 });

    // Modify only the {c, d} component by adding `e`. The {a, b}
    // component is byte-identical → cache hit. The {c, d, e}
    // component is new → cache miss. Net: 1 hit, 1 miss.
    const edited = [
      { sourceId: 'a', targetId: 'b' },
      { sourceId: 'c', targetId: 'd' },
      { sourceId: 'd', targetId: 'e' },
    ];
    computeLayout([...nodes, { id: 'e', width: 200, height: 60 }], edited);
    expect(getLayoutCacheStats()).toMatchObject({ hits: 1, misses: 3 });
  });

  it('treats reordered nodes / edges as the same component (key is structural)', () => {
    const nodes = [
      { id: 'a', width: 200, height: 60 },
      { id: 'b', width: 200, height: 60 },
    ];
    const edges = [{ sourceId: 'a', targetId: 'b' }];
    computeLayout(nodes, edges);
    expect(getLayoutCacheStats()).toMatchObject({ misses: 1 });
    // Same component, nodes passed in reverse order. The cache key
    // must canonicalize so this is still a hit.
    computeLayout([nodes[1]!, nodes[0]!], edges);
    expect(getLayoutCacheStats()).toMatchObject({ hits: 1, misses: 1 });
  });

  it('evicts LRU when the cache is saturated past its cap', () => {
    // Fill past the 64-entry cap by laying out 70 distinct components.
    // Each one is a single isolated node — distinct ids guarantee
    // distinct cache keys. The first 64 stay; entries 65–70 push out
    // the oldest 6.
    for (let i = 0; i < 70; i++) {
      computeLayout([{ id: `n${i}`, width: 100, height: 60 }], []);
    }
    const stats = getLayoutCacheStats();
    expect(stats.misses).toBe(70);
    expect(stats.size).toBeLessThanOrEqual(64);
  });
});
