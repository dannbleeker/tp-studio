/**
 * `useEdgeRoutes` + `computeEdgeRoutes` tests.
 *
 * Two layers under test:
 *
 *  1. **The hook + gate** — `useEdgeRoutes` returns `{}` while the
 *     hard-coded `SMART_ROUTING_ENABLED` constant is `false`. If a
 *     future commit flips that gate without the corresponding
 *     `StoredPrefs.edgeRouting` + Settings UI (Phase C deliverables),
 *     one of these tests fires red as a safety net.
 *  2. **The pure helper** — `computeEdgeRoutes` is what the hook
 *     calls when the gate is on. Phase B exercises it directly so
 *     the iteration logic + per-edge `routeEdge` calls are pinned
 *     before Phase C activates them.
 */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  computeEdgeRoutes,
  SMART_ROUTING_ENABLED,
  useEdgeRoutes,
} from '@/components/canvas/hooks/useEdgeRoutes';
import { useGraphProjection } from '@/components/canvas/hooks/useGraphProjection';
import { computeCollapseProjection } from '@/domain/groups';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../../helpers/seedDoc';

beforeEach(resetStoreForTest);

// -- Gate -------------------------------------------------------------------

describe('SMART_ROUTING_ENABLED gate', () => {
  it('is false on main', () => {
    // If this fires red, the gate has been flipped without the Phase C
    // companion changes (StoredPrefs.edgeRouting + Settings → Display
    // radio + the visibility-graph algorithm itself). Roll back the
    // gate flip or land the full Phase C deliverable.
    expect(SMART_ROUTING_ENABLED).toBe(false);
  });
});

// -- useEdgeRoutes hook ----------------------------------------------------

describe('useEdgeRoutes — short-circuits while the gate is off', () => {
  it('returns {} for an empty doc', () => {
    const doc = useDocumentStore.getState().doc;
    const { result } = renderHook(() => {
      const projection = useGraphProjection(doc);
      return useEdgeRoutes(doc, projection, {});
    });
    expect(result.current).toEqual({});
  });

  it('returns {} when the doc has entities + edges', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const edge = useDocumentStore.getState().connect(a.id, b.id);
    if (!edge) throw new Error('edge not created');
    const doc = useDocumentStore.getState().doc;
    const positions = {
      [a.id]: { x: 0, y: 0 },
      [b.id]: { x: 200, y: 100 },
    };
    const { result } = renderHook(() => {
      const projection = useGraphProjection(doc);
      return useEdgeRoutes(doc, projection, positions);
    });
    expect(result.current).toEqual({});
  });
});

// -- computeEdgeRoutes pure helper (Phase B-tested, gate-independent) ------

/**
 * Build a minimal `GraphProjection` value out of a doc + the entity
 * ids we want as the visible set. The hook normally derives this via
 * `useGraphProjection`, but Phase B tests want a fixture-style
 * shortcut that doesn't pay the React renderHook cost on every test.
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

describe('computeEdgeRoutes — Phase B iteration', () => {
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

  it('routes a colinear 3-node case via a waypoint', () => {
    // A directly above B directly above C. The A→C edge should route
    // around B (single blocker on the straight line).
    const a = seedEntity('A');
    const b = seedEntity('B');
    const c = seedEntity('C');
    const edge = useDocumentStore.getState().connect(a.id, c.id);
    if (!edge) throw new Error('edge not created');
    const doc = useDocumentStore.getState().doc;
    // Dann's tightened layout: ~60 px rank separation. Position the
    // three nodes so the default bezier from A's bottom handle to C's
    // top handle passes through B's body.
    const positions = {
      [a.id]: { x: 0, y: 0 },
      [b.id]: { x: 0, y: 120 },
      [c.id]: { x: 0, y: 240 },
    };
    const projection = projectionOf(doc, [a.id, b.id, c.id]);
    const routes = computeEdgeRoutes(doc, projection, positions);
    const route = routes[edge.id];
    expect(route).toBeDefined();
    expect(route?.waypoints).toHaveLength(3);
  });

  it('does NOT add a waypoint when the obstacle sits beside the line', () => {
    // A above C with B way to the side. The A→C bezier shouldn't be
    // touched.
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
    // Only `a` has a position — `b` is unresolved. The edge should be
    // skipped rather than crashing.
    const routes = computeEdgeRoutes(doc, projection, { [a.id]: { x: 0, y: 0 } });
    expect(routes[edge.id]).toBeUndefined();
  });

  it('routes only one entry per remapped pair (matches aggregation rules)', () => {
    // Two underlying edges A→B (a duplicate). Routing should produce
    // one entry, keyed by the FIRST underlying edge id encountered.
    const a = seedEntity('A');
    const b = seedEntity('B');
    const edge1 = useDocumentStore.getState().connect(a.id, b.id);
    // The second `connect` is a no-op (duplicate is rejected by the
    // store), so explicitly check via the result.
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
});
