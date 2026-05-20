import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AttachedEdgesList } from '@/components/inspector/AttachedEdgesList';
import type { EntityId } from '@/domain/types';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedConnectedPair } from '../helpers/seedDoc';

/**
 * Session 134 coverage push — `AttachedEdgesList` was at 0%.
 *
 * Smoke tests cover the two render branches (empty / non-empty) and
 * the edge-select interaction so a regression in the assumption
 * inspector's "attached to" panel fails loudly.
 */

beforeEach(resetStoreForTest);
afterEach(() => {
  resetStoreForTest();
  cleanup();
});

const s = () => useDocumentStore.getState();

describe('AttachedEdgesList', () => {
  it('renders the empty state when the assumption is unattached', () => {
    render(<AttachedEdgesList assumptionId="not-attached-anywhere" />);
    expect(screen.getByText(/Not attached to any edge/i)).toBeTruthy();
  });

  it('lists every edge the assumption is attached to', () => {
    const { edge } = seedConnectedPair('Root cause', 'Effect');
    const assumption = useDocumentStore.getState().addAssumptionToEdge(edge.id);
    expect(assumption).toBeDefined();
    render(<AttachedEdgesList assumptionId={assumption!.id} />);
    // The row label is `<source> → <target>`.
    expect(screen.getByText(/Root cause/)).toBeTruthy();
    expect(screen.getByText(/Effect/)).toBeTruthy();
  });

  it('clicking an attached edge selects it in the store', () => {
    const { edge } = seedConnectedPair();
    const assumption = useDocumentStore.getState().addAssumptionToEdge(edge.id);
    if (!assumption) throw new Error('addAssumptionToEdge returned undefined');
    render(<AttachedEdgesList assumptionId={assumption.id} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    const sel = s().selection;
    expect(sel.kind).toBe('edges');
    if (sel.kind !== 'edges') return;
    expect(sel.ids).toContain(edge.id);
  });

  it('handles an assumption attached to multiple edges', () => {
    const { edge: e1 } = seedConnectedPair('A', 'B');
    const { edge: e2 } = seedConnectedPair('C', 'D');
    const a1 = useDocumentStore.getState().addAssumptionToEdge(e1.id);
    if (!a1) throw new Error('addAssumptionToEdge failed');
    // Link the SAME assumption id to a second edge by manually adding it.
    useDocumentStore.setState((draft) => ({
      doc: {
        ...draft.doc,
        edges: {
          ...draft.doc.edges,
          [e2.id]: {
            ...draft.doc.edges[e2.id]!,
            assumptionIds: [a1.id as EntityId],
          },
        },
      },
    }));
    render(<AttachedEdgesList assumptionId={a1.id} />);
    // Two buttons (one per attached edge) should be rendered.
    expect(screen.getAllByRole('button').length).toBe(2);
  });
});
