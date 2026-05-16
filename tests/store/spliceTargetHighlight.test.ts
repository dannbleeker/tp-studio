import { resetStoreForTest, useDocumentStore } from '@/store';
import { beforeEach, describe, expect, it } from 'vitest';

/**
 * Session 101 — splice-target highlight transient state. Backs the
 * Alt+drag visual feedback in `Canvas.tsx` / `TPEdge.tsx`.
 *
 * The contract:
 *   - Defaults to `null` on a fresh store.
 *   - `setSpliceTargetEdge('foo')` sets the value.
 *   - `setSpliceTargetEdge(null)` clears it.
 *   - Setting the same value twice is a no-op (no extra writes — the
 *     drag handler fires ~60 times per second and would otherwise
 *     thrash every TPEdge subscribed to the field).
 *
 * The bail-early no-op is the perf-critical bit; we pin it directly
 * by subscribing and counting writes.
 */

beforeEach(resetStoreForTest);

describe('setSpliceTargetEdge', () => {
  it('defaults to null', () => {
    expect(useDocumentStore.getState().spliceTargetEdgeId).toBeNull();
  });

  it('round-trips a string id and back to null', () => {
    const { setSpliceTargetEdge } = useDocumentStore.getState();
    setSpliceTargetEdge('edge-1');
    expect(useDocumentStore.getState().spliceTargetEdgeId).toBe('edge-1');
    setSpliceTargetEdge('edge-2');
    expect(useDocumentStore.getState().spliceTargetEdgeId).toBe('edge-2');
    setSpliceTargetEdge(null);
    expect(useDocumentStore.getState().spliceTargetEdgeId).toBeNull();
  });

  it('bails early when the value is unchanged (no subscriber notification)', () => {
    const { setSpliceTargetEdge } = useDocumentStore.getState();
    setSpliceTargetEdge('edge-1');
    let notifications = 0;
    const unsubscribe = useDocumentStore.subscribe((state, prev) => {
      if (state.spliceTargetEdgeId !== prev.spliceTargetEdgeId) {
        notifications += 1;
      }
    });
    // Twenty redundant writes — the drag handler can fire this fast.
    for (let i = 0; i < 20; i++) setSpliceTargetEdge('edge-1');
    unsubscribe();
    expect(notifications).toBe(0);
  });

  it('does notify when the target id actually changes', () => {
    const { setSpliceTargetEdge } = useDocumentStore.getState();
    setSpliceTargetEdge('edge-1');
    let notifications = 0;
    const unsubscribe = useDocumentStore.subscribe((state, prev) => {
      if (state.spliceTargetEdgeId !== prev.spliceTargetEdgeId) {
        notifications += 1;
      }
    });
    setSpliceTargetEdge('edge-2'); // change
    setSpliceTargetEdge('edge-2'); // no-op
    setSpliceTargetEdge(null); // change
    setSpliceTargetEdge(null); // no-op
    unsubscribe();
    expect(notifications).toBe(2);
  });

  it('clears via the resetStoreForTest helper', () => {
    const { setSpliceTargetEdge } = useDocumentStore.getState();
    setSpliceTargetEdge('edge-1');
    expect(useDocumentStore.getState().spliceTargetEdgeId).toBe('edge-1');
    resetStoreForTest();
    expect(useDocumentStore.getState().spliceTargetEdgeId).toBeNull();
  });
});
