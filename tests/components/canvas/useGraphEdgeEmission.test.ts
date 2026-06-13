import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  EDGE_ARROW_AND_MARKER_ID,
  EDGE_ARROW_MARKER_ID,
} from '@/components/canvas/edges/edgeArrowhead';
import { useGraphEdgeEmission } from '@/components/canvas/hooks/useGraphEdgeEmission';
import type { GraphProjection } from '@/components/canvas/hooks/useGraphProjection';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../../helpers/seedDoc';

beforeEach(() => {
  resetStoreForTest();
  localStorage.clear();
});

const s = () => useDocumentStore.getState();
// The hook only reads `projection.remap`; a bare remap is enough to drive it.
const identity = { remap: (id: string) => id } as unknown as GraphProjection;
const emit = (projection: GraphProjection = identity) =>
  renderHook(() => useGraphEdgeEmission(s().doc, projection)).result.current;

describe('useGraphEdgeEmission', () => {
  it('emits a plain edge with its real id, selectable, and a default arrowhead', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const e = s().connect(a.id, b.id);
    const edges = emit();
    expect(edges).toHaveLength(1);
    expect(edges[0]?.id).toBe(e?.id);
    expect(edges[0]?.selectable).toBe(true);
    expect(edges[0]?.reconnectable).toBe(true); // a real edge can be re-targeted
    // `markerEnd` is the "has arrowhead" signal `TPEdge` reads to draw a custom
    // oriented `<path>` (see `edgeArrowhead.ts`); it's no longer a React Flow marker.
    expect(edges[0]?.markerEnd).toBe(EDGE_ARROW_MARKER_ID);
    expect(edges[0]?.data?.andGroupId).toBeUndefined();
  });

  it('drops the arrowhead on an AND-grouped (junctor) edge and stamps andGroupId', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const c = seedEntity('C');
    const eAC = s().connect(a.id, c.id);
    const eBC = s().connect(b.id, c.id);
    s().groupAsAnd([eAC?.id ?? '', eBC?.id ?? '']);
    const ac = emit().find((e) => e.id === eAC?.id);
    expect(ac?.markerEnd).toBeUndefined(); // the junctor circle owns the arrow
    expect(ac?.data?.andGroupId).toBeDefined();
    expect(ac?.selectable).toBe(true);
  });

  it('collapses multiple edges on one remapped pair into a non-selectable agg edge that keeps its arrowhead', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const c = seedEntity('C');
    s().connect(a.id, c.id);
    s().connect(b.id, c.id);
    // Remap A and B onto one synthetic node G → both edges become G→C.
    const collapse = {
      remap: (id: string) => (id === a.id || id === b.id ? 'G' : id),
    } as unknown as GraphProjection;
    const agg = emit(collapse).find((e) => e.id === `agg:G->${c.id}`);
    expect(agg).toBeDefined();
    expect(agg?.selectable).toBe(false);
    expect(agg?.reconnectable).toBe(false); // synthetic agg edge has no single real endpoint to move
    expect(agg?.data?.aggregateCount).toBe(2);
    expect(agg?.markerEnd).toBe(EDGE_ARROW_MARKER_ID);
  });

  it('uses the AND marker colour for an aggregated junctor edge', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const c = seedEntity('C');
    const eAC = s().connect(a.id, c.id);
    const eBC = s().connect(b.id, c.id);
    s().groupAsAnd([eAC?.id ?? '', eBC?.id ?? '']);
    const collapse = {
      remap: (id: string) => (id === a.id || id === b.id ? 'G' : id),
    } as unknown as GraphProjection;
    const agg = emit(collapse).find((e) => e.id === `agg:G->${c.id}`);
    expect(agg?.markerEnd).toBe(EDGE_ARROW_AND_MARKER_ID);
  });

  it('skips edges whose endpoints remap to the same node (self-loop)', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    s().connect(a.id, b.id);
    const collapseToSelf = { remap: () => 'X' } as unknown as GraphProjection;
    expect(emit(collapseToSelf)).toHaveLength(0);
  });

  it('stamps loopPolarity on exactly one (closing) edge of a cycle', () => {
    // Session 179 — a 2-cycle of all-positive edges is a reinforcing loop; the
    // R/B badge rides only the loop-closing back-edge, so exactly one of the two
    // edges carries the field.
    const a = seedEntity('A');
    const b = seedEntity('B');
    s().connect(a.id, b.id);
    s().connect(b.id, a.id);
    const stamped = emit().filter((e) => e.data?.loopPolarity);
    expect(stamped).toHaveLength(1);
    expect(stamped[0]?.data?.loopPolarity).toBe('reinforcing');
  });

  it('does not stamp loopPolarity on an acyclic edge', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    s().connect(a.id, b.id);
    expect(emit()[0]?.data?.loopPolarity).toBeUndefined();
  });

  describe('hover-fan stamping', () => {
    it('stamps fanRank/fanCount on edges converging on one target (distinct ranks)', () => {
      const a = seedEntity('A');
      const b = seedEntity('B');
      const c = seedEntity('C');
      const d = seedEntity('D');
      s().connect(a.id, d.id);
      s().connect(b.id, d.id);
      s().connect(c.id, d.id);
      const converging = emit().filter((e) => e.target === d.id);
      expect(converging).toHaveLength(3);
      expect(converging.every((e) => e.data?.fanCount === 3)).toBe(true);
      // Each sibling gets a distinct rank across 0..2 so the fan slots don't collide.
      expect(converging.map((e) => e.data?.fanRank).sort()).toEqual([0, 1, 2]);
    });

    it('omits fan fields for a non-converging (lone) edge', () => {
      const a = seedEntity('A');
      const b = seedEntity('B');
      s().connect(a.id, b.id);
      const edge = emit()[0];
      expect(edge?.data?.fanCount).toBeUndefined();
      expect(edge?.data?.fanRank).toBeUndefined();
    });

    it('excludes AND-grouped (junctor) edges — they converge at the junctor, not the target', () => {
      const a = seedEntity('A');
      const b = seedEntity('B');
      const c = seedEntity('C');
      const eAC = s().connect(a.id, c.id);
      const eBC = s().connect(b.id, c.id);
      s().groupAsAnd([eAC?.id ?? '', eBC?.id ?? '']);
      const toC = emit().filter((e) => e.target === c.id);
      expect(toC.every((e) => e.data?.fanCount === undefined)).toBe(true);
    });

    it('does not fan an aggregated edge (one synthetic line into the target)', () => {
      const a = seedEntity('A');
      const b = seedEntity('B');
      const c = seedEntity('C');
      s().connect(a.id, c.id);
      s().connect(b.id, c.id);
      const collapse = {
        remap: (id: string) => (id === a.id || id === b.id ? 'G' : id),
      } as unknown as GraphProjection;
      const agg = emit(collapse).find((e) => e.id === `agg:G->${c.id}`);
      expect(agg?.data?.fanCount).toBeUndefined();
    });
  });
});
