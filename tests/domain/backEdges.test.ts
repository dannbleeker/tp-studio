import { describe, expect, it } from 'vitest';
import { cycleClosingEdgeId, effectiveBackEdgeIds } from '@/domain/backEdges';
import type { TPDocument } from '@/domain/types';

// Minimal doc — the helpers read only entity ids (for the DFS) + each edge's
// sourceId / targetId / isBackEdge.
const mkDoc = (
  entityIds: string[],
  edges: Record<string, { sourceId: string; targetId: string; isBackEdge?: boolean }>
): TPDocument =>
  ({
    entities: Object.fromEntries(entityIds.map((id) => [id, { id, type: 'rootCause', title: id }])),
    edges: Object.fromEntries(
      Object.entries(edges).map(([id, e]) => [id, { id, kind: 'sufficiency', ...e }])
    ),
  }) as unknown as TPDocument;

describe('effectiveBackEdgeIds', () => {
  it('auto-detects the closing edge of a 2-cycle (no manual tag needed)', () => {
    // A→B forward + B→A loop-closer. Canonical cycle [A,B] → closing edge is B→A.
    const doc = mkDoc(['A', 'B'], {
      fwd: { sourceId: 'A', targetId: 'B' },
      back: { sourceId: 'B', targetId: 'A' },
    });
    expect(effectiveBackEdgeIds(doc)).toEqual(new Set(['back']));
  });

  it('unions auto-detected loop-closers with manually tagged edges', () => {
    const doc = mkDoc(['A', 'B', 'C'], {
      fwd: { sourceId: 'A', targetId: 'B' },
      back: { sourceId: 'B', targetId: 'A' },
      tagged: { sourceId: 'B', targetId: 'C', isBackEdge: true },
    });
    expect(effectiveBackEdgeIds(doc)).toEqual(new Set(['back', 'tagged']));
  });

  it('returns an empty set for an acyclic, untagged doc', () => {
    const doc = mkDoc(['A', 'B', 'C'], {
      e1: { sourceId: 'A', targetId: 'B' },
      e2: { sourceId: 'B', targetId: 'C' },
    });
    expect(effectiveBackEdgeIds(doc)).toEqual(new Set());
  });
});

describe('cycleClosingEdgeId', () => {
  it('returns the edge from the last cycle entity back to the first', () => {
    const doc = mkDoc(['A', 'B'], {
      fwd: { sourceId: 'A', targetId: 'B' },
      back: { sourceId: 'B', targetId: 'A' },
    });
    expect(cycleClosingEdgeId(doc, ['A', 'B'])).toBe('back');
  });
});
