/**
 * Phase A — `useEdgeRoutes` hook tests.
 *
 * The hook ships behind a hard-coded `SMART_ROUTING_ENABLED = false`
 * gate; Phase C flips that to a real store-backed preference read. These
 * tests pin two invariants:
 *
 *  1. The gate is currently OFF on main. If a future commit flips it
 *     without adding the corresponding `StoredPrefs.edgeRouting` +
 *     Settings UI (the Phase C deliverables), one of these tests fails
 *     loudly. That's the safety net — a half-flipped gate would ship
 *     smart routing as a hidden, untoggle-able feature.
 *  2. While the gate is off, the hook returns an empty map for any
 *     input — no calls to `routeEdge`, no allocations per edge, no
 *     stamping into `TPEdge.data`.
 *
 * See `docs/EDGE_ROUTING_PROPOSAL.md` for the full design and the
 * three locked decisions (Bezier visual style / 'smart' default / hold
 * for Phase C).
 */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { SMART_ROUTING_ENABLED, useEdgeRoutes } from '@/components/canvas/hooks/useEdgeRoutes';
import { useGraphProjection } from '@/components/canvas/hooks/useGraphProjection';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../../helpers/seedDoc';

beforeEach(resetStoreForTest);

describe('Phase A ship gate', () => {
  it('SMART_ROUTING_ENABLED is false on main', () => {
    // If this fires red, the gate has been flipped without the Phase C
    // companion changes (StoredPrefs.edgeRouting + Settings → Display
    // radio + the visibility-graph algorithm itself). Roll back the
    // gate flip or land the full Phase C deliverable.
    expect(SMART_ROUTING_ENABLED).toBe(false);
  });
});

describe('useEdgeRoutes — Phase A returns empty map', () => {
  // We render the hook against a minimal doc with a couple of entities
  // + one edge to be sure that the early-exit on the gate runs against
  // a realistic input shape, not just `{}`.
  it('returns {} for an empty doc', () => {
    const doc = useDocumentStore.getState().doc;
    const { result } = renderHook(() => {
      const projection = useGraphProjection(doc);
      // Positions don't matter while the gate is off — pass an empty
      // map. Real callers thread the dagre-derived positions in.
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
    // Specifically — no entry for the real edge id, even though it
    // exists in the doc.
    expect(Object.keys(result.current)).toHaveLength(0);
  });
});
