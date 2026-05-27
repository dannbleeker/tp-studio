/**
 * `useEdgeRoutes` + `computeEdgeRoutes` tests.
 *
 * Two layers under test:
 *
 *  1. **The hook + preference** — `useEdgeRoutes` returns `{}` when the
 *     user's `edgeRouting` preference is `'direct'` (the opt-out) and
 *     a populated map when the preference is `'smart'` (the default).
 *  2. **The pure helper** — `computeEdgeRoutes` is what the hook calls
 *     when the preference is `'smart'`. The iteration logic + per-edge
 *     `routeEdge` invocation is exercised directly.
 */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { computeEdgeRoutes, useEdgeRoutes } from '@/components/canvas/hooks/useEdgeRoutes';
import { useGraphProjection } from '@/components/canvas/hooks/useGraphProjection';
import { computeCollapseProjection } from '@/domain/groups';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../../helpers/seedDoc';

beforeEach(resetStoreForTest);

// -- Preference defaults ---------------------------------------------------

describe('edgeRouting preference', () => {
  it('defaults to smart routing on a fresh store', () => {
    // Locked decision per `docs/EDGE_ROUTING_PROPOSAL.md`: smart is the
    // first-release default. If this fires red, the opt-out flipped to
    // the default — review whether that was deliberate.
    expect(useDocumentStore.getState().edgeRouting).toBe('smart');
  });

  it('persists across setEdgeRouting calls', () => {
    useDocumentStore.getState().setEdgeRouting('direct');
    expect(useDocumentStore.getState().edgeRouting).toBe('direct');
    useDocumentStore.getState().setEdgeRouting('smart');
    expect(useDocumentStore.getState().edgeRouting).toBe('smart');
  });
});

// -- useEdgeRoutes hook ----------------------------------------------------

describe('useEdgeRoutes — preference-gated', () => {
  it('returns {} when edgeRouting is "direct"', () => {
    useDocumentStore.getState().setEdgeRouting('direct');
    const a = seedEntity('A');
    const b = seedEntity('B');
    const edge = useDocumentStore.getState().connect(a.id, b.id);
    if (!edge) throw new Error('edge not created');
    const doc = useDocumentStore.getState().doc;
    const positions = {
      [a.id]: { x: 0, y: 0 },
      [b.id]: { x: 0, y: 200 },
    };
    const { result } = renderHook(() => {
      const projection = useGraphProjection(doc);
      return useEdgeRoutes(doc, projection, positions);
    });
    expect(result.current).toEqual({});
  });

  it('returns a populated map when edgeRouting is "smart" (default)', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const edge = useDocumentStore.getState().connect(a.id, b.id);
    if (!edge) throw new Error('edge not created');
    const doc = useDocumentStore.getState().doc;
    const positions = {
      [a.id]: { x: 0, y: 0 },
      [b.id]: { x: 0, y: 200 },
    };
    const { result } = renderHook(() => {
      const projection = useGraphProjection(doc);
      return useEdgeRoutes(doc, projection, positions);
    });
    expect(result.current[edge.id]).toBeDefined();
    expect(result.current[edge.id]?.waypoints.length).toBeGreaterThanOrEqual(2);
  });
});

// -- computeEdgeRoutes pure helper ----------------------------------------

/**
 * Build a minimal `GraphProjection` value out of a doc + the entity
 * ids we want as the visible set. The hook normally derives this via
 * `useGraphProjection`, but the tests want a fixture-style shortcut
 * that doesn't pay the React renderHook cost on every test.
 */
const projectionOf = (
  doc: ReturnType<typeof useDocumentStore.getState>['doc'],
  visibleIds: string[]
) => {
  const proj = computeCollapseProjection(doc);
  const visibleEntityIds = new Set(visibleIds);
  return {
    proj,
    visibleEntityIds,
    visibleCollapsedRoots: [] as string[],
    hoistVisibleGroups: new Set<string>(),
    remap: (id: string) => (visibleEntityIds.has(id) ? id : null),
    hiddenCountByCollapser: new Map<string, number>(),
  };
};

describe('computeEdgeRoutes — iteration', () => {
  it('routes a single edge with no obstacles via the default bezier', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const edge = useDocumentStore.getState().connect(a.id, b.id);
    if (!edge) throw new Error('edge not created');
    const doc = useDocumentStore.getState().doc;
    const positions = {
      [a.id]: { x: 0, y: 0 },
      [b.id]: { x: 0, y: 200 },
    };
    const projection = projectionOf(doc, [a.id, b.id]);
    const routes = computeEdgeRoutes(doc, projection, positions);
    expect(routes[edge.id]).toBeDefined();
    expect(routes[edge.id]?.waypoints).toHaveLength(2);
  });

  it('routes a colinear 3-node case via interior waypoint(s)', () => {
    // A directly above B directly above C. The A→C edge should route
    // around B; A* yields at least one interior waypoint.
    const a = seedEntity('A');
    const b = seedEntity('B');
    const c = seedEntity('C');
    const edge = useDocumentStore.getState().connect(a.id, c.id);
    if (!edge) throw new Error('edge not created');
    const doc = useDocumentStore.getState().doc;
    const positions = {
      [a.id]: { x: 0, y: 0 },
      [b.id]: { x: 0, y: 120 },
      [c.id]: { x: 0, y: 240 },
    };
    const projection = projectionOf(doc, [a.id, b.id, c.id]);
    const routes = computeEdgeRoutes(doc, projection, positions);
    const route = routes[edge.id];
    expect(route).toBeDefined();
    expect(route?.waypoints.length).toBeGreaterThanOrEqual(3);
  });

  it('does NOT add a waypoint when the obstacle sits beside the line', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const c = seedEntity('C');
    const edge = useDocumentStore.getState().connect(a.id, c.id);
    if (!edge) throw new Error('edge not created');
    const doc = useDocumentStore.getState().doc;
    const positions = {
      [a.id]: { x: 0, y: 0 },
      [b.id]: { x: 600, y: 100 },
      [c.id]: { x: 0, y: 200 },
    };
    const projection = projectionOf(doc, [a.id, b.id, c.id]);
    const routes = computeEdgeRoutes(doc, projection, positions);
    expect(routes[edge.id]?.waypoints).toHaveLength(2);
  });

  it('skips edges whose endpoints have no position (transient state)', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const edge = useDocumentStore.getState().connect(a.id, b.id);
    if (!edge) throw new Error('edge not created');
    const doc = useDocumentStore.getState().doc;
    const projection = projectionOf(doc, [a.id, b.id]);
    const routes = computeEdgeRoutes(doc, projection, { [a.id]: { x: 0, y: 0 } });
    expect(routes[edge.id]).toBeUndefined();
  });

  it('routes only one entry per remapped pair (matches aggregation rules)', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const edge1 = useDocumentStore.getState().connect(a.id, b.id);
    const edge2 = useDocumentStore.getState().connect(a.id, b.id);
    if (!edge1) throw new Error('edge1 not created');
    expect(edge2).toBeNull();
    const doc = useDocumentStore.getState().doc;
    const positions = {
      [a.id]: { x: 0, y: 0 },
      [b.id]: { x: 0, y: 200 },
    };
    const projection = projectionOf(doc, [a.id, b.id]);
    const routes = computeEdgeRoutes(doc, projection, positions);
    expect(Object.keys(routes)).toEqual([edge1.id]);
  });

  it('amortises the visibility-graph build across many edges (Phase D cache)', () => {
    // Phase D's per-layout cache: building the visibility graph once
    // for the whole layout pass should make 50 edges in a 50-node
    // diagram complete well inside the budget. Without the cache,
    // this took ~8 s on CI (see commit history); with the cache, it
    // drops to single-digit ms locally and well under 5 s on CI.
    const ENTITY_COUNT = 50;
    const ids: string[] = [];
    for (let i = 0; i < ENTITY_COUNT; i++) {
      ids.push(seedEntity(`E${i}`).id);
    }
    // Chain the entities into a sequence of 49 edges.
    const store = useDocumentStore.getState();
    for (let i = 0; i < ENTITY_COUNT - 1; i++) {
      const a = ids[i];
      const b = ids[i + 1];
      if (a && b) store.connect(a, b);
    }
    const doc = useDocumentStore.getState().doc;
    const positions: Record<string, { x: number; y: number }> = {};
    for (let i = 0; i < ENTITY_COUNT; i++) {
      const id = ids[i];
      if (id) positions[id] = { x: (i % 5) * 250, y: Math.floor(i / 5) * 100 };
    }
    const projection = projectionOf(doc, ids);
    // Warm-up + timed pass.
    computeEdgeRoutes(doc, projection, positions);
    const start = performance.now();
    const routes = computeEdgeRoutes(doc, projection, positions);
    const elapsed = performance.now() - start;
    expect(Object.keys(routes).length).toBeGreaterThan(0);
    // The cache means total work is O(n² m) once + O(A* per edge);
    // 5 s ceiling is wide enough for CI variability while catching
    // genuine regressions (no-cache would push to 30 s+).
    expect(elapsed).toBeLessThan(5000);
  }, 30000);

  it('routes a junctor-member edge to the junctor bottom perimeter (Phase D)', () => {
    // Two source entities A, B both connecting to target C. Group
    // A→C and B→C as an AND-junctor; the edges should now route to
    // C's junctor circle bottom rather than C's top handle.
    const { e1: edgeA, e2: edgeB } = (() => {
      const aE = seedEntity('A');
      const bE = seedEntity('B');
      const cE = seedEntity('C');
      const store = useDocumentStore.getState();
      const e1 = store.connect(aE.id, cE.id);
      const e2 = store.connect(bE.id, cE.id);
      if (!e1 || !e2) throw new Error('edges not created');
      // Form the AND junctor over the two edges.
      const result = store.groupAsAnd([e1.id, e2.id]);
      if (!result.ok) throw new Error(`groupAsAnd failed: ${result.reason}`);
      return { e1, e2 };
    })();
    const doc = useDocumentStore.getState().doc;
    // Pin positions so the test is deterministic.
    const visibleIds = Object.keys(doc.entities);
    const positions: Record<string, { x: number; y: number }> = {};
    if (visibleIds[0]) positions[visibleIds[0]] = { x: 0, y: 0 };
    if (visibleIds[1]) positions[visibleIds[1]] = { x: 240, y: 0 };
    if (visibleIds[2]) positions[visibleIds[2]] = { x: 120, y: 240 };
    const projection = projectionOf(doc, visibleIds);
    const routes = computeEdgeRoutes(doc, projection, positions);
    const routeA = routes[edgeA.id];
    const routeB = routes[edgeB.id];
    expect(routeA).toBeDefined();
    expect(routeB).toBeDefined();
    // The last waypoint of a junctor-member route should be the
    // junctor circle's bottom perimeter, NOT C's top handle.
    // C's top is y=240; the junctor terminal is `240 + 35 + 14 = 289`
    // (JUNCTOR_CENTER_OFFSET_Y + JUNCTOR_RADIUS — verified in
    // src/domain/constants.ts).
    const lastA = routeA?.waypoints[routeA.waypoints.length - 1];
    const lastB = routeB?.waypoints[routeB.waypoints.length - 1];
    expect(lastA?.y).toBeGreaterThan(240);
    expect(lastB?.y).toBeGreaterThan(240);
  });
});
