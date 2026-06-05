import { beforeEach, describe, expect, it } from 'vitest';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);

/**
 * Selection-slice ACTIONS (the pure helpers live in `selectionHelpers.test.ts`).
 * Covers the cross-kind toggle transitions, the canvas-mode start/cancel guards
 * (each cancel only clears ITS own mode), and the three `completePendingEdge`
 * exits: wrong-mode, self-loop, and the happy path that creates an edge.
 */

const store = () => useDocumentStore.getState();

describe('toggleEntitySelection', () => {
  it('starts a fresh entity selection when an edge (or nothing) was selected', () => {
    store().selectEdge('eg1');
    store().toggleEntitySelection('e1');
    expect(store().selection).toEqual({ kind: 'entities', ids: ['e1'] });
  });

  it('adds then removes within an entity selection, collapsing to none', () => {
    store().toggleEntitySelection('e1');
    store().toggleEntitySelection('e2');
    expect(store().selection).toEqual({ kind: 'entities', ids: ['e1', 'e2'] });
    store().toggleEntitySelection('e1');
    expect(store().selection).toEqual({ kind: 'entities', ids: ['e2'] });
    store().toggleEntitySelection('e2');
    expect(store().selection).toEqual({ kind: 'none' });
  });
});

describe('toggleEdgeSelection', () => {
  it('starts a fresh edge selection when an entity (or nothing) was selected', () => {
    store().selectEntity('e1');
    store().toggleEdgeSelection('eg1');
    expect(store().selection).toEqual({ kind: 'edges', ids: ['eg1'] });
  });

  it('toggles an edge off, collapsing to none', () => {
    store().toggleEdgeSelection('eg1');
    store().toggleEdgeSelection('eg1');
    expect(store().selection).toEqual({ kind: 'none' });
  });
});

describe('canvas-mode start / cancel guards', () => {
  it('edge-join: start sets the mode, cancel returns to idle', () => {
    store().startEdgeJoinMode('eg1');
    expect(store().canvasMode).toEqual({ kind: 'edge-join', edgeId: 'eg1' });
    store().cancelEdgeJoinMode();
    expect(store().canvasMode).toEqual({ kind: 'idle' });
  });

  it('cancelEdgeJoinMode is a no-op when a different mode is active', () => {
    store().startPendingEdge('e1');
    store().cancelEdgeJoinMode();
    expect(store().canvasMode).toEqual({ kind: 'pending-edge', sourceId: 'e1' });
  });

  it('cancelPendingEdge is a no-op when a different mode is active', () => {
    store().startEdgeJoinMode('eg1');
    store().cancelPendingEdge();
    expect(store().canvasMode).toEqual({ kind: 'edge-join', edgeId: 'eg1' });
  });
});

describe('completePendingEdge', () => {
  it('returns null when not in pending-edge mode', () => {
    expect(store().completePendingEdge('e1')).toBeNull();
  });

  it('rejects a self-loop and returns to idle', () => {
    const a = seedEntity('A');
    store().startPendingEdge(a.id);
    expect(store().completePendingEdge(a.id)).toBeNull();
    expect(store().canvasMode).toEqual({ kind: 'idle' });
  });

  it('creates the edge, returns its id, and clears the mode on the happy path', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    store().startPendingEdge(a.id);
    const edgeId = store().completePendingEdge(b.id);
    expect(edgeId).toBeTruthy();
    expect(store().canvasMode).toEqual({ kind: 'idle' });
    const edge = store().doc.edges[edgeId as string];
    expect(edge?.sourceId).toBe(a.id);
    expect(edge?.targetId).toBe(b.id);
  });
});
