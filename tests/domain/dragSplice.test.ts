import { describe, expect, it } from 'vitest';
import {
  findOverlappingEdgeIds,
  findSpliceTargetEdge,
  pointToSegmentDistanceSq,
} from '@/domain/dragSplice';
import type { Edge } from '@/domain/types';

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
  // `id` / `sourceId` / `targetId` are branded string types
  // (`EdgeId` / `EntityId`); narrow casts on each field replace the
  // older one-shot `as unknown as Edge` so the intent reads "these
  // plain strings stand in as branded ids" instead of "bypass the
  // type-check entirely".
  const mkEdge = (id: string, sourceId: string, targetId: string): Edge => ({
    id: id as Edge['id'],
    sourceId: sourceId as Edge['sourceId'],
    targetId: targetId as Edge['targetId'],
    kind: 'sufficiency',
  });

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

describe('findOverlappingEdgeIds', () => {
  // `pt()` (a call, not an object literal) keeps the point arrays inline — biome
  // force-breaks an array whose elements are bare object literals one-per-line.
  const pt = (x: number, y: number) => ({ x, y });

  it('returns EVERY edge whose polyline passes within tolerance (a stack)', () => {
    // Two horizontal lines 10 apart; a click at y=5 is 5 from each → both hit.
    const hits = findOverlappingEdgeIds({
      point: pt(50, 5),
      candidates: [
        { id: 'top', points: [pt(0, 0), pt(100, 0)] },
        { id: 'bottom', points: [pt(0, 10), pt(100, 10)] },
      ],
      tolerance: 8,
    });
    expect(hits.sort()).toEqual(['bottom', 'top']);
  });

  it('excludes edges outside the tolerance', () => {
    const hits = findOverlappingEdgeIds({
      point: pt(50, 5),
      candidates: [
        { id: 'near', points: [pt(0, 0), pt(100, 0)] },
        { id: 'far', points: [pt(0, 200), pt(100, 200)] },
      ],
      tolerance: 8,
    });
    expect(hits).toEqual(['near']);
  });

  it('walks multi-segment polylines — any segment within tolerance counts once', () => {
    // L-shaped polyline; the click sits near its vertical second segment only.
    const hits = findOverlappingEdgeIds({
      point: pt(100, 50),
      candidates: [{ id: 'L', points: [pt(0, 0), pt(100, 0), pt(100, 100)] }],
      tolerance: 5,
    });
    expect(hits).toEqual(['L']);
  });

  it('returns an empty array when nothing is within tolerance', () => {
    const hits = findOverlappingEdgeIds({
      point: pt(500, 500),
      candidates: [{ id: 'e', points: [pt(0, 0), pt(10, 0)] }],
      tolerance: 8,
    });
    expect(hits).toEqual([]);
  });

  it('ignores degenerate candidates with fewer than two points', () => {
    const hits = findOverlappingEdgeIds({
      point: pt(0, 0),
      candidates: [{ id: 'pt', points: [pt(0, 0)] }],
      tolerance: 8,
    });
    expect(hits).toEqual([]);
  });
});
