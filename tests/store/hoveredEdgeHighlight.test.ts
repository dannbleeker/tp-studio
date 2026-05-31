import { beforeEach, describe, expect, it } from 'vitest';
import { resetStoreForTest, useDocumentStore } from '@/store';

/**
 * Goal #3 — hovered-edge highlight transient state. Backs the select-hover
 * cue in `TPEdge.tsx` (a +1px stroke + faint grey glow + pointer cursor) so
 * an edge's otherwise-invisible 56px hit zone is discoverable on mouse-over.
 * Written by `useGraphMutations`' `onEdgeMouseEnter` / `onEdgeMouseLeave`.
 *
 * The contract mirrors `spliceTargetEdgeId` exactly:
 *   - Defaults to `null` on a fresh store.
 *   - `setHoveredEdge('foo')` sets the value; `setHoveredEdge(null)` clears it.
 *   - Setting the same value twice is a no-op (no extra writes — edge
 *     mousemove can refire for the same id, and every visible TPEdge
 *     subscribes to `hoveredEdgeId === props.id`, so a redundant write would
 *     thrash reconciliation across the whole canvas).
 *
 * The bail-early no-op is the perf-critical bit; we pin it directly by
 * subscribing and counting writes.
 */

beforeEach(resetStoreForTest);

describe('setHoveredEdge', () => {
  it('defaults to null', () => {
    expect(useDocumentStore.getState().hoveredEdgeId).toBeNull();
  });

  it('round-trips a string id and back to null', () => {
    const { setHoveredEdge } = useDocumentStore.getState();
    setHoveredEdge('edge-1');
    expect(useDocumentStore.getState().hoveredEdgeId).toBe('edge-1');
    setHoveredEdge('edge-2');
    expect(useDocumentStore.getState().hoveredEdgeId).toBe('edge-2');
    setHoveredEdge(null);
    expect(useDocumentStore.getState().hoveredEdgeId).toBeNull();
  });

  it('bails early when the value is unchanged (no subscriber notification)', () => {
    const { setHoveredEdge } = useDocumentStore.getState();
    setHoveredEdge('edge-1');
    let notifications = 0;
    const unsubscribe = useDocumentStore.subscribe((state, prev) => {
      if (state.hoveredEdgeId !== prev.hoveredEdgeId) {
        notifications += 1;
      }
    });
    // Twenty redundant writes — a stationary pointer over one edge can
    // refire mouseenter/mousemove this fast.
    for (let i = 0; i < 20; i++) setHoveredEdge('edge-1');
    unsubscribe();
    expect(notifications).toBe(0);
  });

  it('does notify when the hovered id actually changes', () => {
    const { setHoveredEdge } = useDocumentStore.getState();
    setHoveredEdge('edge-1');
    let notifications = 0;
    const unsubscribe = useDocumentStore.subscribe((state, prev) => {
      if (state.hoveredEdgeId !== prev.hoveredEdgeId) {
        notifications += 1;
      }
    });
    setHoveredEdge('edge-2'); // change
    setHoveredEdge('edge-2'); // no-op
    setHoveredEdge(null); // change
    setHoveredEdge(null); // no-op
    unsubscribe();
    expect(notifications).toBe(2);
  });

  it('clears via the resetStoreForTest helper', () => {
    const { setHoveredEdge } = useDocumentStore.getState();
    setHoveredEdge('edge-1');
    expect(useDocumentStore.getState().hoveredEdgeId).toBe('edge-1');
    resetStoreForTest();
    expect(useDocumentStore.getState().hoveredEdgeId).toBeNull();
  });
});
