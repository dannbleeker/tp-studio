import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  EDGE_ARROW_AND_MARKER_ID,
  EDGE_ARROW_MARKER_ID,
} from '@/components/canvas/edges/EdgeArrowMarkers';
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
    // Bare custom-marker id — React Flow wraps it as url('#…'); colour lives in
    // the live-palette marker def (EdgeArrowMarkers), not on the edge.
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
});
