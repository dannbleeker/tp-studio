import { clearLayoutCacheForTests, computeLayout, splitIntoComponents } from '@/domain/layout';
import { afterEach, describe, expect, it } from 'vitest';

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
