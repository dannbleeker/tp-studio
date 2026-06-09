import { beforeEach, describe, expect, it } from 'vitest';
import { assumptionsForEdge } from '@/domain/graph';
import { resetStoreForTest, useDocumentStore } from '@/store';

beforeEach(resetStoreForTest);

/**
 * Session 87 / EC PPT comparison item #6 — assumption-badge count
 * sourcing.
 *
 * Record-canonical (v10): the badge count is driven SOLELY by the
 * `doc.assumptions` records keyed to the edge via `edgeId` (the legacy
 * `Edge.assumptionIds` index was removed). The actual SVG portal is
 * rendered via React Flow's `EdgeLabelRenderer`, which requires a live
 * React Flow runtime — not testable in isolation here. These tests pin
 * the COUNT-COMPUTATION SHAPE instead, mirroring the production selector
 * (`useGraphEdgeEmission` counts `doc.assumptions` by `edgeId`).
 */

const assumptionCount = (edgeId: string): number =>
  assumptionsForEdge(useDocumentStore.getState().doc, edgeId).length;

describe('TPEdge assumption count sourcing (Session 87)', () => {
  it('returns 0 when the edge has no assumption records', () => {
    const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
    const b = useDocumentStore.getState().addEntity({ type: 'effect', title: 'B' });
    const edge = useDocumentStore.getState().connect(a.id, b.id);
    expect(assumptionCount(edge!.id)).toBe(0);
  });

  it('counts the doc.assumptions records keyed to the edge', () => {
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
    expect(assumptionCount(edge!.id)).toBe(2);
  });

  it('counts only the records keyed to THIS edge, ignoring records on other edges', () => {
    const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
    const b = useDocumentStore.getState().addEntity({ type: 'effect', title: 'B' });
    const c = useDocumentStore.getState().addEntity({ type: 'effect', title: 'C' });
    const edge = useDocumentStore.getState().connect(a.id, b.id);
    const other = useDocumentStore.getState().connect(b.id, c.id);
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
          'asm-other': {
            id: 'asm-other',
            edgeId: other!.id,
            text: 'b',
            status: 'unexamined',
            createdAt: 1,
            updatedAt: 1,
          },
        },
      },
    }));
    expect(assumptionCount(edge!.id)).toBe(1);
    expect(assumptionCount(other!.id)).toBe(1);
  });
});
