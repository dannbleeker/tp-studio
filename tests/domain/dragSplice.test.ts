import { findSpliceTargetEdge, pointToSegmentDistanceSq } from '@/domain/dragSplice';
import type { Edge } from '@/domain/types';
import { describe, expect, it } from 'vitest';

/**
 * Session 83 — geometry tests for the drag-to-splice hit-test. Pure
 * functions; no DOM, no store. Catches the kind of regression where a
 * future refactor accidentally drops the segment-clamp (turning the
 * point-to-segment distance into a point-to-infinite-line distance,
 * which would hit-test edges that don't extend to the drop point).
 */

describe('pointToSegmentDistanceSq', () => {
  it('returns 0 for a point on the segment', () => {
    expect(pointToSegmentDistanceSq({ x: 5, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(0);
  });

  it('returns the squared distance to the perpendicular projection when inside the segment', () => {
    // Point at (5, 3), segment along the x-axis from (0,0)-(10,0).
    // Perpendicular distance = 3 → squared = 9.
    expect(pointToSegmentDistanceSq({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(9);
  });

  it('clamps to the endpoint when the projection falls outside the segment', () => {
    // Point at (-3, 0) projects to t = -0.3, clamped to 0 → distance to (0, 0) = 3, squared = 9.
    expect(pointToSegmentDistanceSq({ x: -3, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(9);
    // Point at (13, 0) projects to t = 1.3, clamped to 1 → distance to (10, 0) = 3, squared = 9.
    expect(pointToSegmentDistanceSq({ x: 13, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(9);
  });

  it('handles a degenerate segment (a === b) as point-to-point distance', () => {
    expect(pointToSegmentDistanceSq({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(25);
  });
});

describe('findSpliceTargetEdge', () => {
  const mkEdge = (id: string, sourceId: string, targetId: string): Edge =>
    ({
      id,
      sourceId,
      targetId,
      kind: 'sufficiency',
    }) as unknown as Edge;

  it('returns null when no edge is within tolerance', () => {
    const result = findSpliceTargetEdge({
      point: { x: 500, y: 500 },
      draggedEntityId: 'z',
      edges: [mkEdge('e1', 'a', 'b')],
      entityPositions: {
        a: { x: 0, y: 0 },
        b: { x: 100, y: 0 },
      },
      tolerance: 20,
    });
    expect(result).toBeNull();
  });

  it('returns the edge whose centerline passes near the point', () => {
    const result = findSpliceTargetEdge({
      point: { x: 50, y: 5 },
      draggedEntityId: 'z',
      edges: [mkEdge('e1', 'a', 'b')],
      entityPositions: {
        a: { x: 0, y: 0 },
        b: { x: 100, y: 0 },
      },
      tolerance: 20,
    });
    expect(result).not.toBeNull();
    expect(result!.edgeId).toBe('e1');
  });

  it('picks the closest of multiple candidates', () => {
    const result = findSpliceTargetEdge({
      point: { x: 50, y: 5 },
      draggedEntityId: 'z',
      edges: [mkEdge('far', 'a', 'b'), mkEdge('near', 'c', 'd')],
      entityPositions: {
        a: { x: 0, y: 200 },
        b: { x: 100, y: 200 },
        c: { x: 0, y: 0 },
        d: { x: 100, y: 0 },
      },
      tolerance: 250,
    });
    expect(result!.edgeId).toBe('near');
  });

  it('skips edges that touch the dragged entity', () => {
    const result = findSpliceTargetEdge({
      point: { x: 50, y: 5 },
      draggedEntityId: 'a',
      edges: [mkEdge('e1', 'a', 'b')],
      entityPositions: {
        a: { x: 0, y: 0 },
        b: { x: 100, y: 0 },
      },
      tolerance: 20,
    });
    // The dragged entity is `a` and the only edge involves `a` — filter it out.
    expect(result).toBeNull();
  });

  it('skips edges whose endpoints lack a known position', () => {
    const result = findSpliceTargetEdge({
      point: { x: 50, y: 5 },
      draggedEntityId: 'z',
      edges: [mkEdge('e1', 'a', 'b')],
      entityPositions: {
        a: { x: 0, y: 0 },
        // b is missing
      },
      tolerance: 20,
    });
    expect(result).toBeNull();
  });
});
