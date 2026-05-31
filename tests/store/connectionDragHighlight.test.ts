import { beforeEach, describe, expect, it } from 'vitest';
import { resetStoreForTest, useDocumentStore } from '@/store';

/**
 * Goal #2 — connection-drag feedback transient state. `connectingFromId`
 * (the source while a connection drag is in flight) + `connectionDropEdgeId`
 * (the edge currently hovered as a "drop to AND" target) back the
 * drop-target highlights in TPNode / TPEdge / JunctorOverlay.
 *
 * Contract per field: defaults `null`; the setter round-trips string↔null;
 * setting the same value twice is a no-op (no subscriber notification — the
 * edge-hover writer can fire fast during a drag); `resetStoreForTest` clears
 * it. The no-op guard is the perf-critical bit, pinned by a write count.
 */

beforeEach(resetStoreForTest);

describe('setConnectingFrom', () => {
  it('defaults to null', () => {
    expect(useDocumentStore.getState().connectingFromId).toBeNull();
  });

  it('round-trips a source id and back to null', () => {
    const { setConnectingFrom } = useDocumentStore.getState();
    setConnectingFrom('node-1');
    expect(useDocumentStore.getState().connectingFromId).toBe('node-1');
    setConnectingFrom(null);
    expect(useDocumentStore.getState().connectingFromId).toBeNull();
  });

  it('bails early when the value is unchanged (no subscriber notification)', () => {
    const { setConnectingFrom } = useDocumentStore.getState();
    setConnectingFrom('node-1');
    let notifications = 0;
    const unsubscribe = useDocumentStore.subscribe((state, prev) => {
      if (state.connectingFromId !== prev.connectingFromId) notifications += 1;
    });
    for (let i = 0; i < 20; i++) setConnectingFrom('node-1');
    unsubscribe();
    expect(notifications).toBe(0);
  });

  it('clears via the resetStoreForTest helper', () => {
    useDocumentStore.getState().setConnectingFrom('node-1');
    resetStoreForTest();
    expect(useDocumentStore.getState().connectingFromId).toBeNull();
  });
});

describe('setConnectionDropEdge', () => {
  it('defaults to null', () => {
    expect(useDocumentStore.getState().connectionDropEdgeId).toBeNull();
  });

  it('round-trips an edge id and back to null', () => {
    const { setConnectionDropEdge } = useDocumentStore.getState();
    setConnectionDropEdge('edge-1');
    expect(useDocumentStore.getState().connectionDropEdgeId).toBe('edge-1');
    setConnectionDropEdge(null);
    expect(useDocumentStore.getState().connectionDropEdgeId).toBeNull();
  });

  it('bails early when the value is unchanged (no subscriber notification)', () => {
    const { setConnectionDropEdge } = useDocumentStore.getState();
    setConnectionDropEdge('edge-1');
    let notifications = 0;
    const unsubscribe = useDocumentStore.subscribe((state, prev) => {
      if (state.connectionDropEdgeId !== prev.connectionDropEdgeId) notifications += 1;
    });
    for (let i = 0; i < 20; i++) setConnectionDropEdge('edge-1');
    unsubscribe();
    expect(notifications).toBe(0);
  });

  it('clears via the resetStoreForTest helper', () => {
    useDocumentStore.getState().setConnectionDropEdge('edge-1');
    resetStoreForTest();
    expect(useDocumentStore.getState().connectionDropEdgeId).toBeNull();
  });
});
