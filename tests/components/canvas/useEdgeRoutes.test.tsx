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
import { junctorCenterX } from '@/components/canvas/edges/junctorGeometry';
import {
  computeEdgeRoutes,
  junctorObstacleBoxes,
  respectsFlow,
  useEdgeRoutes,
} from '@/components/canvas/hooks/useEdgeRoutes';
import { useGraphProjection } from '@/components/canvas/hooks/useGraphProjection';
import {
  JUNCTOR_CENTER_OFFSET_Y,
  JUNCTOR_RADIUS,
  JUNCTOR_RADIUS_X,
  NODE_MIN_HEIGHT,
  NODE_WIDTH,
} from '@/domain/constants';
import { polylinesCross } from '@/domain/edgeGeometry';
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
    visibleCollapsedRootsSet: new Set<string>(),
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

  it('routes a back-edge out the source top and into the target bottom', () => {
    // B (back-edge source) sits ABOVE A (target), so the position-based pick would be
    // bottom/top; the back-edge override forces top/bottom — exit the source top, enter
    // the target bottom (the flow direction). Item 1.
    const a = seedEntity('A');
    const b = seedEntity('B');
    const state = useDocumentStore.getState();
    state.connect(a.id, b.id);
    const back = state.connect(b.id, a.id);
    if (!back) throw new Error('back-edge not created');
    state.updateEdge(back.id, { isBackEdge: true });
    const doc = useDocumentStore.getState().doc;
    const positions = {
      [b.id]: { x: 0, y: 0 },
      [a.id]: { x: 0, y: 300 },
    };
    const projection = projectionOf(doc, [a.id, b.id]);
    const wp = computeEdgeRoutes(doc, projection, positions)[back.id]?.waypoints ?? [];
    expect(wp[0]?.y).toBe(0); // source B top
    expect(wp[wp.length - 1]?.y).toBe(300 + NODE_MIN_HEIGHT); // target A bottom
  });

  it('bows a back-edge out to one side so it reads as a loop (item 2)', () => {
    // Same B-above-A back-edge: the route now bows sideways into a 3-point loop
    // instead of running straight down through both boxes / the forward corridor.
    const a = seedEntity('A');
    const b = seedEntity('B');
    const state = useDocumentStore.getState();
    state.connect(a.id, b.id);
    const back = state.connect(b.id, a.id);
    if (!back) throw new Error('back-edge not created');
    state.updateEdge(back.id, { isBackEdge: true });
    const doc = useDocumentStore.getState().doc;
    const positions = {
      [b.id]: { x: 0, y: 0 },
      [a.id]: { x: 0, y: 300 },
    };
    const projection = projectionOf(doc, [a.id, b.id]);
    const wp = computeEdgeRoutes(doc, projection, positions)[back.id]?.waypoints ?? [];
    expect(wp).toHaveLength(3);
    // The anchors share an x (vertically aligned); the apex sits well off it.
    const anchorX = wp[0]?.x ?? 0;
    expect(Math.abs((wp[1]?.x ?? anchorX) - anchorX)).toBeGreaterThan(50);
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

  it('does NOT route junctor-member edges (they render via the measured bezier)', () => {
    // Junctor cause-edges are excluded from A* routing. Their visible path is
    // TPEdge's bezier, redirected to the junctor circle's bottom perimeter via
    // the target's MEASURED bottom-handle Y — so it lands exactly on the circle
    // JunctorOverlay paints. The router only has fixed NODE_MIN_HEIGHT obstacle
    // boxes, so a routed terminus would sit ~a node-height off the (measured)
    // circle (the "AND/OR/XOR cause-edges miss the circle" bug). So a junctor
    // edge must carry NO route entry and fall through to the bezier.
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
    const visibleIds = Object.keys(doc.entities);
    const positions: Record<string, { x: number; y: number }> = {};
    if (visibleIds[0]) positions[visibleIds[0]] = { x: 0, y: 0 };
    if (visibleIds[1]) positions[visibleIds[1]] = { x: 240, y: 0 };
    if (visibleIds[2]) positions[visibleIds[2]] = { x: 120, y: 240 };
    const projection = projectionOf(doc, visibleIds);
    const routes = computeEdgeRoutes(doc, projection, positions);
    expect(routes[edgeA.id]).toBeUndefined();
    expect(routes[edgeB.id]).toBeUndefined();
  });
});

// -- Feature #5 — 4-side anchoring -----------------------------------------

describe('computeEdgeRoutes — 4-side anchoring', () => {
  const HALF_W = NODE_WIDTH / 2;
  const HALF_H = NODE_MIN_HEIGHT / 2;

  it('keeps source-bottom / target-top when the source sits above the target', () => {
    // The common dagre case (parent above child). Anchors are unchanged
    // from the old fixed behaviour — facing sides happen to be bottom/top.
    const a = seedEntity('A');
    const b = seedEntity('B');
    const edge = useDocumentStore.getState().connect(a.id, b.id);
    if (!edge) throw new Error('edge not created');
    const doc = useDocumentStore.getState().doc;
    const positions = { [a.id]: { x: 0, y: 0 }, [b.id]: { x: 0, y: 200 } };
    const projection = projectionOf(doc, [a.id, b.id]);
    const wp = computeEdgeRoutes(doc, projection, positions)[edge.id]?.waypoints;
    expect(wp?.[0]).toEqual({ x: HALF_W, y: NODE_MIN_HEIGHT }); // source bottom
    expect(wp?.[1]).toEqual({ x: HALF_W, y: 200 }); // target top
  });

  it('flips to source-top / target-bottom when the source sits below the target (BT fix)', () => {
    // Production dagre `BT`: cause below, effect above. The position-based
    // picker now anchors on the FACING sides — source top, target bottom —
    // instead of the old fixed source-bottom / target-top (which pointed
    // the edge the long way round).
    const a = seedEntity('A');
    const b = seedEntity('B');
    const edge = useDocumentStore.getState().connect(a.id, b.id);
    if (!edge) throw new Error('edge not created');
    const doc = useDocumentStore.getState().doc;
    const positions = { [a.id]: { x: 0, y: 200 }, [b.id]: { x: 0, y: 0 } };
    const projection = projectionOf(doc, [a.id, b.id]);
    const wp = computeEdgeRoutes(doc, projection, positions)[edge.id]?.waypoints;
    expect(wp?.[0]).toEqual({ x: HALF_W, y: 200 }); // source top
    expect(wp?.[1]).toEqual({ x: HALF_W, y: NODE_MIN_HEIGHT }); // target bottom
  });

  it('anchors on left/right facing sides for a horizontal (ec) layout', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const edge = useDocumentStore.getState().connect(a.id, b.id);
    if (!edge) throw new Error('edge not created');
    // Flip the active doc to a horizontal layout type — only `diagramType`
    // drives the axis; the seeded entities are otherwise unchanged.
    useDocumentStore.setState((s) => ({ doc: { ...s.doc, diagramType: 'ec' as const } }));
    const doc = useDocumentStore.getState().doc;
    const positions = { [a.id]: { x: 0, y: 0 }, [b.id]: { x: 300, y: 0 } };
    const projection = projectionOf(doc, [a.id, b.id]);
    const wp = computeEdgeRoutes(doc, projection, positions)[edge.id]?.waypoints;
    expect(wp?.[0]).toEqual({ x: NODE_WIDTH, y: HALF_H }); // source right side
    expect(wp?.[1]).toEqual({ x: 300, y: HALF_H }); // target left side
  });

  it('junctor edge: not routed — bypasses 4-side anchoring entirely', () => {
    // Junctor edges no longer participate in side-anchoring: they are skipped
    // by the router and render via TPEdge's measured bezier into the circle.
    const a = seedEntity('A');
    const b = seedEntity('B');
    const c = seedEntity('C');
    const store = useDocumentStore.getState();
    const e1 = store.connect(a.id, c.id);
    const e2 = store.connect(b.id, c.id);
    if (!e1 || !e2) throw new Error('edges not created');
    const grp = store.groupAsAnd([e1.id, e2.id]);
    if (!grp.ok) throw new Error(`groupAsAnd failed: ${grp.reason}`);
    const doc = useDocumentStore.getState().doc;
    const positions = {
      [a.id]: { x: 500, y: 200 },
      [b.id]: { x: 520, y: 200 },
      [c.id]: { x: 0, y: 0 },
    };
    const projection = projectionOf(doc, [a.id, b.id, c.id]);
    const routes = computeEdgeRoutes(doc, projection, positions);
    expect(routes[e1.id]).toBeUndefined();
    expect(routes[e2.id]).toBeUndefined();
  });
});

// -- Junctor circles as obstacles (Session 171) ----------------------------
// The junctor circle is an overlay the router otherwise can't see, so an
// unrelated edge could pass behind it ("edge going through the AND"). These pin
// the obstacle box the router now adds so such edges route around the circle.
describe('junctorObstacleBoxes', () => {
  it('returns one box per group, centred over the causes', () => {
    const a = seedEntity('A'); // cause
    const b = seedEntity('B'); // cause
    const c = seedEntity('C'); // target / effect
    const store = useDocumentStore.getState();
    const e1 = store.connect(a.id, c.id);
    const e2 = store.connect(b.id, c.id);
    if (!e1 || !e2) throw new Error('edges not created');
    const grp = store.groupAsAnd([e1.id, e2.id]);
    if (!grp.ok) throw new Error(`groupAsAnd failed: ${grp.reason}`);
    const doc = useDocumentStore.getState().doc;
    const positions = {
      [a.id]: { x: 0, y: 400 },
      [b.id]: { x: 400, y: 400 },
      [c.id]: { x: 200, y: 0 },
    };
    const boxes = junctorObstacleBoxes(doc, positions);
    expect(boxes.size).toBe(1);
    const [key, box] = [...boxes.entries()][0] ?? ['', null];
    expect(key.startsWith('junctor:')).toBe(true);
    if (!box) throw new Error('no box');
    // Box centre = the junctor circle centre (over the causes, nudged toward the
    // target); the line up to the effect is what becomes diagonal.
    const cx = junctorCenterX([NODE_WIDTH / 2, 400 + NODE_WIDTH / 2], 200 + NODE_WIDTH / 2);
    const cy = NODE_MIN_HEIGHT + JUNCTOR_CENTER_OFFSET_Y;
    expect(box.x + box.width / 2).toBeCloseTo(cx, 6);
    expect(box.y + box.height / 2).toBeCloseTo(cy, 6);
    // Size = the visible ellipse + an 8 px margin so edges clear it.
    expect(box.width).toBe(2 * (JUNCTOR_RADIUS_X + 8));
    expect(box.height).toBe(2 * (JUNCTOR_RADIUS + 8));
  });

  it('returns no boxes for a junctor-free doc', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    useDocumentStore.getState().connect(a.id, b.id);
    const doc = useDocumentStore.getState().doc;
    const boxes = junctorObstacleBoxes(doc, {
      [a.id]: { x: 0, y: 0 },
      [b.id]: { x: 0, y: 200 },
    });
    expect(boxes.size).toBe(0);
  });
});

// -- Crossing-aware reroute (#5) -------------------------------------------
describe('computeEdgeRoutes — crossing-aware reroute', () => {
  it('keeps a crossing rather than routing an edge against the chart flow', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const c = seedEntity('C');
    const d = seedEntity('D');
    const store = useDocumentStore.getState();
    const e1 = store.connect(a.id, c.id); // A→C — main diagonal
    const e2 = store.connect(b.id, d.id); // B→D — anti-diagonal, crosses e1
    if (!e1 || !e2) throw new Error('edges not created');
    const doc = useDocumentStore.getState().doc;
    // Four corners, generous spacing — the two diagonals cross in the middle and
    // there's room to route one around the other.
    const positions = {
      [a.id]: { x: 0, y: 0 },
      [b.id]: { x: 500, y: 0 },
      [c.id]: { x: 500, y: 500 },
      [d.id]: { x: 0, y: 500 },
    };
    const projection = projectionOf(doc, [a.id, b.id, c.id, d.id]);
    const routes = computeEdgeRoutes(doc, projection, positions);
    const wp1 = routes[e1.id]?.waypoints ?? [];
    const wp2 = routes[e2.id]?.waypoints ?? [];
    expect(wp1.length).toBeGreaterThanOrEqual(2);
    expect(wp2.length).toBeGreaterThanOrEqual(2);
    // These two diagonals can only be uncrossed by sending an edge backward (out
    // of its source→target flow band) — so #5 keeps the crossing instead of
    // routing against the chart flow (Dann's rule).
    expect(polylinesCross(wp1, wp2)).toBe(true);
  });

  it('leaves a clean (non-crossing) layout untouched — two straight 2-waypoint routes', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const c = seedEntity('C');
    const d = seedEntity('D');
    const store = useDocumentStore.getState();
    const e1 = store.connect(a.id, b.id);
    const e2 = store.connect(c.id, d.id);
    if (!e1 || !e2) throw new Error('edges not created');
    const doc = useDocumentStore.getState().doc;
    // Two parallel vertical edges, far apart — never cross, so decross is a no-op.
    const positions = {
      [a.id]: { x: 0, y: 0 },
      [b.id]: { x: 0, y: 300 },
      [c.id]: { x: 400, y: 0 },
      [d.id]: { x: 400, y: 300 },
    };
    const projection = projectionOf(doc, [a.id, b.id, c.id, d.id]);
    const routes = computeEdgeRoutes(doc, projection, positions);
    expect(routes[e1.id]?.waypoints).toHaveLength(2);
    expect(routes[e2.id]?.waypoints).toHaveLength(2);
  });
});

describe('respectsFlow (decross flow guard)', () => {
  const p = (x: number, y: number) => ({ x, y });

  it('passes a vertical-flow route that only swings sideways within the band', () => {
    expect(respectsFlow([p(0, 0), p(80, 50), p(0, 100)], 'vertical')).toBe(true);
  });

  it('rejects a route that backtracks behind the source (against an upward flow)', () => {
    // Endpoints span y 0..100; the middle waypoint at y 160 dips out of the band.
    expect(respectsFlow([p(0, 100), p(0, 160), p(0, 0)], 'vertical')).toBe(false);
  });

  it('rejects a route that overshoots past the target', () => {
    expect(respectsFlow([p(0, 0), p(0, -40), p(0, 100)], 'vertical')).toBe(false);
  });

  it('uses the X axis as the flow direction for a horizontal (EC) layout', () => {
    expect(respectsFlow([p(0, 0), p(-40, 0), p(100, 0)], 'horizontal')).toBe(false);
    expect(respectsFlow([p(0, 0), p(50, 30), p(100, 0)], 'horizontal')).toBe(true);
  });
});
