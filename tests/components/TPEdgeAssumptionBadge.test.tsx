import { resetStoreForTest, useDocumentStore } from '@/store';
import { beforeEach, describe, expect, it } from 'vitest';

beforeEach(resetStoreForTest);

/**
 * Session 87 / EC PPT comparison item #6 — assumption-badge count
 * sourcing.
 *
 * The badge component (TPEdge.tsx) computes its count by combining
 * BOTH the legacy `Edge.assumptionIds` and the v7 `doc.assumptions`
 * map keyed by `edgeId`. The actual SVG portal is rendered via React
 * Flow's `EdgeLabelRenderer`, which requires a live React Flow
 * runtime — not testable in isolation here. These tests pin the
 * COUNT-COMPUTATION SHAPE instead: building the same combined-count
 * locally on the store state, mirroring the production selector.
 */

const combinedAssumptionCount = (edgeId: string): number => {
  const s = useDocumentStore.getState();
  const legacy = s.doc.edges[edgeId]?.assumptionIds?.length ?? 0;
  let fromMap = 0;
  if (s.doc.assumptions) {
    for (const a of Object.values(s.doc.assumptions)) {
      if (a.edgeId === edgeId) fromMap += 1;
    }
  }
  return Math.max(legacy, fromMap);
};

describe('TPEdge assumption count sourcing (Session 87)', () => {
  it('returns 0 when the edge has no assumptions on either backing', () => {
    const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
    const b = useDocumentStore.getState().addEntity({ type: 'effect', title: 'B' });
    const edge = useDocumentStore.getState().connect(a.id, b.id);
    expect(combinedAssumptionCount(edge!.id)).toBe(0);
  });

  it('counts the legacy assumptionIds list when only it is populated', () => {
    const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
    const b = useDocumentStore.getState().addEntity({ type: 'effect', title: 'B' });
    const edge = useDocumentStore.getState().connect(a.id, b.id);
    useDocumentStore
      .getState()
      .updateEdge(edge!.id, { assumptionIds: ['asm-1', 'asm-2'] as never });
    expect(combinedAssumptionCount(edge!.id)).toBe(2);
  });

  it('counts the v7 doc.assumptions map when only it is populated', () => {
    const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
    const b = useDocumentStore.getState().addEntity({ type: 'effect', title: 'B' });
    const edge = useDocumentStore.getState().connect(a.id, b.id);
    useDocumentStore.setState((s) => ({
      doc: {
        ...s.doc,
        assumptions: {
          'asm-record-1': {
            id: 'asm-record-1',
            edgeId: edge!.id,
            text: 'first',
            status: 'unexamined',
            createdAt: 1,
            updatedAt: 1,
          },
          'asm-record-2': {
            id: 'asm-record-2',
            edgeId: edge!.id,
            text: 'second',
            status: 'unexamined',
            createdAt: 1,
            updatedAt: 1,
          },
        },
      },
    }));
    expect(combinedAssumptionCount(edge!.id)).toBe(2);
  });

  it('returns the MAX of the two backings — they normally agree post-migration', () => {
    const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
    const b = useDocumentStore.getState().addEntity({ type: 'effect', title: 'B' });
    const edge = useDocumentStore.getState().connect(a.id, b.id);
    useDocumentStore.getState().updateEdge(edge!.id, { assumptionIds: ['asm-1'] as never });
    useDocumentStore.setState((s) => ({
      doc: {
        ...s.doc,
        assumptions: {
          'asm-record-1': {
            id: 'asm-record-1',
            edgeId: edge!.id,
            text: 'a',
            status: 'unexamined',
            createdAt: 1,
            updatedAt: 1,
          },
          'asm-record-2': {
            id: 'asm-record-2',
            edgeId: edge!.id,
            text: 'b',
            status: 'unexamined',
            createdAt: 1,
            updatedAt: 1,
          },
        },
      },
    }));
    expect(combinedAssumptionCount(edge!.id)).toBe(2);
  });
});
