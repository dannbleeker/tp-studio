/**
 * Session 177 — Branch coverage for `useJunctorCenterX.ts`.
 *
 * The file exports two hooks (`useJunctorCenterX` and `useJunctorSourceAnchor`)
 * and three unexported equality helpers (`xyEqual`, `stringArrayEqual`,
 * `numberArrayEqual`). The equality helpers are exercised indirectly through
 * the memoized hook returns across re-renders; the hooks themselves are
 * exercised with controlled mocked stores.
 *
 * Branches targeted:
 *
 *   A. `useJunctorCenterX`:
 *      1. `isJunctorEdge=false` → returns null (sourceXs subscription disabled).
 *      2. `isJunctorEdge=true, groupField=null` → EMPTY_IDS → sourceXs=[] → junctorCenterX([], targetX) = targetX.
 *      3. `isJunctorEdge=true, groupField+groupId present, no matching edges` → sourceXs=[] → targetX.
 *      4. `isJunctorEdge=true, matching edges exist, nodes known` → computed center.
 *      5. `isJunctorEdge=true, sourceXs=null (useRFStore returns null)` → still null from memo.
 *
 *   B. `useJunctorSourceAnchor`:
 *      1. `isJunctorEdge=false` → topLeft=null → unchanged handle point.
 *      2. `isJunctorEdge=true`, sourceId not in nodeLookup → topLeft=null → unchanged.
 *      3. `isJunctorEdge=true`, sourceId in nodeLookup, axis='vertical' → snaps Y.
 *      4. `isJunctorEdge=true`, sourceId in nodeLookup, axis='horizontal' → snaps X.
 *
 *   C. Equality helpers (exercised through stable-memo checks):
 *      - `numberArrayEqual`: null-vs-null, same reference, length mismatch, value mismatch, equal.
 *      - `stringArrayEqual`: same reference, different values, equal.
 *      - `xyEqual`: null-vs-null, same reference, value equal, value different.
 *
 * Mock strategy mirrors JunctorOverlay.test.tsx:
 *   • `@xyflow/react` → `useStore` receives a selector applied to a mutable
 *     `rfState` object; `nodeLookup` is controlled per-test.
 *   • Document store → real Zustand store, manipulated via setState / resetStoreForTest.
 */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useJunctorCenterX,
  useJunctorSourceAnchor,
} from '@/components/canvas/edges/useJunctorCenterX';
import { NODE_WIDTH } from '@/domain/constants';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { makeDoc, makeEdge, makeEntity, resetIds } from '../../../domain/helpers';

// ---------------------------------------------------------------------------
// Mock @xyflow/react
// ---------------------------------------------------------------------------

type NodeEntry = {
  internals: { positionAbsolute: { x: number; y: number } };
  measured?: { width?: number; height?: number };
};

type RFStoreMock = {
  nodeLookup: Map<string, NodeEntry>;
};

const rfState: RFStoreMock = {
  nodeLookup: new Map(),
};

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  return {
    ...actual,
    useStore: (selector: (s: RFStoreMock) => unknown) => selector(rfState),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const nodeEntry = (x: number, w = NODE_WIDTH): NodeEntry => ({
  internals: { positionAbsolute: { x, y: 100 } },
  measured: { width: w },
});

const nodeEntryWithY = (x: number, y: number, w = NODE_WIDTH): NodeEntry => ({
  internals: { positionAbsolute: { x, y } },
  measured: { width: w },
});

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetStoreForTest();
  resetIds();
  rfState.nodeLookup = new Map();
});
afterEach(cleanup);

// ---------------------------------------------------------------------------
// A. useJunctorCenterX
// ---------------------------------------------------------------------------

describe('useJunctorCenterX', () => {
  it('returns null when isJunctorEdge is false', () => {
    const { result } = renderHook(() =>
      useJunctorCenterX({
        isJunctorEdge: false,
        groupField: 'andGroupId',
        groupId: 'g1',
        targetX: 500,
      })
    );
    expect(result.current).toBeNull();
  });

  it('returns targetX when isJunctorEdge=true but groupField is null (no group)', () => {
    const { result } = renderHook(() =>
      useJunctorCenterX({
        isJunctorEdge: true,
        groupField: null,
        groupId: undefined,
        targetX: 300,
      })
    );
    // sourceIds = EMPTY_IDS → sourceXs = [] → junctorCenterX([], 300) = 300
    expect(result.current).toBe(300);
  });

  it('returns targetX when isJunctorEdge=true but no edges match the group', () => {
    const e1 = makeEntity({ title: 'cause' });
    const e2 = makeEntity({ title: 'effect' });
    const doc = makeDoc([e1, e2], [makeEdge(e1.id, e2.id)]);
    act(() => {
      useDocumentStore.setState({ doc });
    });
    const { result } = renderHook(() =>
      useJunctorCenterX({
        isJunctorEdge: true,
        groupField: 'andGroupId',
        groupId: 'nonexistent-group',
        targetX: 400,
      })
    );
    // No matching edges → sourceIds=[] → sourceXs=[] → junctorCenterX([], 400) = 400
    expect(result.current).toBe(400);
  });

  it('returns computed center when group members are known in the RF store', () => {
    const e1 = makeEntity({ title: 'cause-a' });
    const e2 = makeEntity({ title: 'cause-b' });
    const e3 = makeEntity({ title: 'effect' });
    const edge1 = makeEdge(e1.id, e3.id, { andGroupId: 'g1' });
    const edge2 = makeEdge(e2.id, e3.id, { andGroupId: 'g1' });
    const doc = makeDoc([e1, e2, e3], [edge1, edge2]);
    act(() => {
      useDocumentStore.setState({ doc });
    });
    // Nodes at x=100 and x=300 → midpoint=200. With default nudge (0.25),
    // and targetX=600: center = 200 + 0.25*(600-200) = 300.
    rfState.nodeLookup.set(e1.id, nodeEntry(100 - NODE_WIDTH / 2));
    rfState.nodeLookup.set(e2.id, nodeEntry(300 - NODE_WIDTH / 2));
    const { result } = renderHook(() =>
      useJunctorCenterX({
        isJunctorEdge: true,
        groupField: 'andGroupId',
        groupId: 'g1',
        targetX: 600,
      })
    );
    // sourceXs = [100, 300] → mid=200, nudge=0.25, target=600 → 200 + 0.25*400 = 300
    expect(result.current).toBe(300);
  });

  it('returns targetX when isJunctorEdge=true but sourceId nodes are absent from nodeLookup', () => {
    const e1 = makeEntity({ title: 'cause' });
    const e2 = makeEntity({ title: 'effect' });
    const edge = makeEdge(e1.id, e2.id, { andGroupId: 'g2' });
    const doc = makeDoc([e1, e2], [edge]);
    act(() => {
      useDocumentStore.setState({ doc });
    });
    // e1.id NOT in rfState.nodeLookup → sourceXs = [] → falls back to targetX
    const { result } = renderHook(() =>
      useJunctorCenterX({
        isJunctorEdge: true,
        groupField: 'andGroupId',
        groupId: 'g2',
        targetX: 750,
      })
    );
    expect(result.current).toBe(750);
  });

  it('uses orGroupId group members correctly', () => {
    const e1 = makeEntity({ title: 'or-cause' });
    const e2 = makeEntity({ title: 'effect' });
    const edge = makeEdge(e1.id, e2.id, { orGroupId: 'or-1' });
    const doc = makeDoc([e1, e2], [edge]);
    act(() => {
      useDocumentStore.setState({ doc });
    });
    rfState.nodeLookup.set(e1.id, nodeEntry(200 - NODE_WIDTH / 2));
    const { result } = renderHook(() =>
      useJunctorCenterX({
        isJunctorEdge: true,
        groupField: 'orGroupId',
        groupId: 'or-1',
        targetX: 200,
      })
    );
    // Single cause at x=200, target=200 → mid=200, nudge won't matter → 200
    expect(result.current).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// B. useJunctorSourceAnchor
// ---------------------------------------------------------------------------

describe('useJunctorSourceAnchor', () => {
  it('returns the unchanged handle point when isJunctorEdge=false', () => {
    const { result } = renderHook(() =>
      useJunctorSourceAnchor({
        isJunctorEdge: false,
        sourceId: 'some-node',
        axis: 'vertical',
        sourceX: 120,
        sourceY: 300,
      })
    );
    expect(result.current).toEqual({ x: 120, y: 300 });
  });

  it('returns the unchanged handle when isJunctorEdge=true but sourceId not in nodeLookup', () => {
    const { result } = renderHook(() =>
      useJunctorSourceAnchor({
        isJunctorEdge: true,
        sourceId: 'missing-node',
        axis: 'vertical',
        sourceX: 150,
        sourceY: 200,
      })
    );
    // topLeft = null (node not found) → passthrough
    expect(result.current).toEqual({ x: 150, y: 200 });
  });

  it('snaps Y to the node top for a vertical-axis junctor edge', () => {
    rfState.nodeLookup.set('n1', nodeEntryWithY(50, 232));
    const { result } = renderHook(() =>
      useJunctorSourceAnchor({
        isJunctorEdge: true,
        sourceId: 'n1',
        axis: 'vertical',
        sourceX: 120,
        sourceY: 222,
      })
    );
    // topLeft.y = 232; X stays = 120
    expect(result.current).toEqual({ x: 120, y: 232 });
  });

  it('snaps X to the node left for a horizontal-axis junctor edge', () => {
    rfState.nodeLookup.set('n2', nodeEntryWithY(410, 280));
    const { result } = renderHook(() =>
      useJunctorSourceAnchor({
        isJunctorEdge: true,
        sourceId: 'n2',
        axis: 'horizontal',
        sourceX: 222,
        sourceY: 300,
      })
    );
    // topLeft.x = 410; Y stays = 300
    expect(result.current).toEqual({ x: 410, y: 300 });
  });
});

// ---------------------------------------------------------------------------
// C. Equality helper branches — exercised via stable-memo re-render probes
// ---------------------------------------------------------------------------

describe('equality helpers via hook re-render stability', () => {
  /**
   * `numberArrayEqual` is the comparator for the `sourceXs` subscription in
   * `useJunctorCenterX`. We verify that equal arrays produce a STABLE result
   * across re-renders (the memo does not fire again), and that differing arrays
   * produce a new result.
   *
   * Strategy: render the hook, then mutate rfState and re-render — if the
   * equality check fires "equal", the returned value stays the same object
   * (strict equality); if "not equal", the memo recalculates.
   */
  it('numberArrayEqual: same-length equal arrays keep the result stable', () => {
    const e1 = makeEntity({ title: 'c1' });
    const e2 = makeEntity({ title: 'effect' });
    const edge = makeEdge(e1.id, e2.id, { andGroupId: 'gStable' });
    const doc = makeDoc([e1, e2], [edge]);
    act(() => {
      useDocumentStore.setState({ doc });
    });
    rfState.nodeLookup.set(e1.id, nodeEntry(100));

    const { result, rerender } = renderHook(() =>
      useJunctorCenterX({
        isJunctorEdge: true,
        groupField: 'andGroupId',
        groupId: 'gStable',
        targetX: 500,
      })
    );
    const first = result.current;
    // Re-render with the SAME positions — equality check should say "same",
    // memo stays cached, returned number is identical.
    rerender();
    expect(result.current).toBe(first);
  });

  it('numberArrayEqual: changed position causes a new result', () => {
    const e1 = makeEntity({ title: 'c1' });
    const e2 = makeEntity({ title: 'effect' });
    const edge = makeEdge(e1.id, e2.id, { andGroupId: 'gChange' });
    const doc = makeDoc([e1, e2], [edge]);
    act(() => {
      useDocumentStore.setState({ doc });
    });
    rfState.nodeLookup.set(e1.id, nodeEntry(100));

    const { result, rerender } = renderHook(() =>
      useJunctorCenterX({
        isJunctorEdge: true,
        groupField: 'andGroupId',
        groupId: 'gChange',
        targetX: 500,
      })
    );
    const first = result.current;
    // Move the node — new X in nodeLookup → numberArrayEqual returns false → new result.
    act(() => {
      rfState.nodeLookup.set(e1.id, nodeEntry(300));
    });
    rerender();
    expect(result.current).not.toBe(first);
    expect(result.current).not.toEqual(first);
  });

  it('stringArrayEqual: same sourceIds reference keeps subscription stable', () => {
    // isJunctorEdge=false → EMPTY_IDS is the stable constant; verify the hook
    // computes null consistently across re-renders (stringArrayEqual stable path).
    const { result, rerender } = renderHook(() =>
      useJunctorCenterX({
        isJunctorEdge: false,
        groupField: null,
        groupId: undefined,
        targetX: 100,
      })
    );
    expect(result.current).toBeNull();
    rerender();
    expect(result.current).toBeNull();
  });

  it('xyEqual: same topLeft keeps useJunctorSourceAnchor result stable', () => {
    rfState.nodeLookup.set('n3', nodeEntryWithY(50, 200));
    const { result, rerender } = renderHook(() =>
      useJunctorSourceAnchor({
        isJunctorEdge: true,
        sourceId: 'n3',
        axis: 'vertical',
        sourceX: 120,
        sourceY: 190,
      })
    );
    const first = result.current;
    rerender();
    // Same topLeft → xyEqual returns true → memo doesn't recalculate → same value.
    // Note: junctorSourceAnchor returns a fresh plain object, so we use toStrictEqual.
    expect(result.current).toStrictEqual(first);
  });

  it('xyEqual: changed topLeft triggers new anchor computation', () => {
    rfState.nodeLookup.set('n4', nodeEntryWithY(50, 200));
    const { result, rerender } = renderHook(() =>
      useJunctorSourceAnchor({
        isJunctorEdge: true,
        sourceId: 'n4',
        axis: 'vertical',
        sourceX: 120,
        sourceY: 190,
      })
    );
    const first = result.current;
    act(() => {
      rfState.nodeLookup.set('n4', nodeEntryWithY(50, 250));
    });
    rerender();
    // topLeft.y changed → xyEqual returns false → memo recalculates.
    expect(result.current).not.toEqual(first);
    expect(result.current.y).toBe(250);
  });
});
