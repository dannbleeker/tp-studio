import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useGraphEdgeEmission } from '@/components/canvas/hooks/useGraphEdgeEmission';
import type { GraphProjection } from '@/components/canvas/hooks/useGraphProjection';
import type { Assumption, TPDocument } from '@/domain/types';
import { makeDoc, makeEdge, makeEntity, resetIds } from '../../domain/helpers';

/**
 * Session 135 / Perf #17 — `useGraphEdgeEmission` now precomputes each
 * edge's assumption count and stamps it into `data.assumptionCount`, so
 * `TPEdge` reads an O(1) prop instead of iterating `doc.assumptions`
 * inside its per-edge store selector on every store change. These tests
 * lock that the emitted count is correct (counted from the first-class
 * `doc.assumptions` records keyed by `edgeId`) and omitted when zero.
 */

// The hook only reads `projection.remap`; an identity remap models the
// no-collapse case. Cast the partial shape — the rest is unused here.
const identityProjection = { remap: (id: string) => id } as unknown as GraphProjection;

const assumption = (edgeId: string, id: string): Assumption => ({
  id,
  edgeId,
  text: 'because…',
  status: 'unexamined',
  createdAt: 0,
  updatedAt: 0,
});

const withAssumptions = (doc: TPDocument, records: Assumption[]): TPDocument => ({
  ...doc,
  assumptions: Object.fromEntries(records.map((a) => [a.id, a])),
});

describe('useGraphEdgeEmission — assumption count stamping (Perf #17)', () => {
  it('stamps the count of first-class assumption records keyed to the edge', () => {
    resetIds();
    const a = makeEntity();
    const b = makeEntity();
    const edge = makeEdge(a.id, b.id);
    const doc = withAssumptions(makeDoc([a, b], [edge]), [
      assumption(edge.id, 'as-1'),
      assumption(edge.id, 'as-2'),
    ]);
    const { result } = renderHook(() => useGraphEdgeEmission(doc, identityProjection));
    const emitted = result.current.find((e) => e.id === edge.id);
    expect(emitted?.data?.assumptionCount).toBe(2);
  });

  it('stamps a count of 1 for an edge with a single record', () => {
    resetIds();
    const a = makeEntity();
    const b = makeEntity();
    const edge = makeEdge(a.id, b.id);
    const doc = withAssumptions(makeDoc([a, b], [edge]), [assumption(edge.id, 'as-1')]);
    const { result } = renderHook(() => useGraphEdgeEmission(doc, identityProjection));
    const emitted = result.current.find((e) => e.id === edge.id);
    expect(emitted?.data?.assumptionCount).toBe(1);
  });

  it('omits assumptionCount entirely when the edge has none', () => {
    resetIds();
    const a = makeEntity();
    const b = makeEntity();
    const edge = makeEdge(a.id, b.id);
    const doc = makeDoc([a, b], [edge]);
    const { result } = renderHook(() => useGraphEdgeEmission(doc, identityProjection));
    const emitted = result.current.find((e) => e.id === edge.id);
    expect(emitted?.data?.assumptionCount).toBeUndefined();
  });
});
