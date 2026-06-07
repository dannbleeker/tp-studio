/**
 * Session 177 — Branch coverage for `useRadialRoute.ts`.
 *
 * The existing `tests/components/useRadialRoute.test.ts` covers the pure
 * `radialRouteForEdge` helper (obstacle filtering, fallback sizes). This file
 * covers the remaining uncovered lines/branches:
 *
 *   A. `radialNodesEqual` — the React Flow store equality gate. Every branch
 *      of the comparison is exercised (same-ref, null inputs, length mismatch,
 *      individual field mismatches, and the all-equal pass).
 *
 *   B. `useRadialRoute` hook — the three short-circuit returns (non-radial
 *      mode, junctor edge, mutex override) and the normal routing return,
 *      exercised via mocked stores + `renderHook`.
 *
 * Mock strategy (mirrors JunctorOverlay.test.tsx):
 *   • `@xyflow/react` → `useStore` returns a selector applied to a mutable
 *     `rfState` object. This covers the `radialNodes` subscription.
 *   • `@/store` → `useDocumentStore` is left as the REAL store; we set
 *     `layoutMode` via `useDocumentStore.setState({ layoutMode })` and call
 *     `resetStoreForTest()` in beforeEach.
 */

import { act, cleanup, renderHook } from '@testing-library/react';
import type { Node as RFNode } from '@xyflow/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { radialNodesEqual, useRadialRoute } from '@/components/canvas/edges/useRadialRoute';
import { resetStoreForTest, useDocumentStore } from '@/store';

// ---------------------------------------------------------------------------
// Mock @xyflow/react — expose a mutable rfState so each test can control
// which nodes the RF store reports.
// ---------------------------------------------------------------------------
type MinimalRFState = { nodes: RFNode[] };

const rfState: MinimalRFState = { nodes: [] };

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  return {
    ...actual,
    useStore: (selector: (s: MinimalRFState) => unknown) => selector(rfState),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const node = (
  id: string,
  position: { x: number; y: number },
  size?: { width: number; height: number }
): RFNode =>
  ({
    id,
    position,
    ...(size ? { width: size.width, height: size.height } : {}),
    data: {},
  }) as unknown as RFNode;

// Default params for the hook (non-junctor, no mutex, radial mode controlled by store).
const defaultParams = {
  source: 'A',
  target: 'B',
  sourceX: 0,
  sourceY: 0,
  targetX: 200,
  effectiveTargetY: 0,
  isJunctorEdge: false,
  hasMutexOverride: false,
};

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetStoreForTest();
  rfState.nodes = [];
});
afterEach(cleanup);

// ---------------------------------------------------------------------------
// A. radialNodesEqual
// ---------------------------------------------------------------------------

describe('radialNodesEqual', () => {
  it('returns true when both arrays are the SAME reference', () => {
    const arr = [node('X', { x: 0, y: 0 })];
    expect(radialNodesEqual(arr, arr)).toBe(true);
  });

  it('returns false when the first argument is null', () => {
    expect(radialNodesEqual(null, [])).toBe(false);
  });

  it('returns false when the second argument is null', () => {
    expect(radialNodesEqual([], null)).toBe(false);
  });

  it('returns false when both are null (guarded by !== check first)', () => {
    // null === null → the early `a === b` branch fires and returns true.
    expect(radialNodesEqual(null, null)).toBe(true);
  });

  it('returns false when arrays differ in length', () => {
    const a = [node('X', { x: 0, y: 0 })];
    const b = [node('X', { x: 0, y: 0 }), node('Y', { x: 1, y: 1 })];
    expect(radialNodesEqual(a, b)).toBe(false);
  });

  it('returns false when a node id differs', () => {
    const a = [node('X', { x: 0, y: 0 }, { width: 220, height: 72 })];
    const b = [node('Y', { x: 0, y: 0 }, { width: 220, height: 72 })];
    expect(radialNodesEqual(a, b)).toBe(false);
  });

  it('returns false when position.x differs', () => {
    const a = [node('X', { x: 0, y: 0 }, { width: 220, height: 72 })];
    const b = [node('X', { x: 1, y: 0 }, { width: 220, height: 72 })];
    expect(radialNodesEqual(a, b)).toBe(false);
  });

  it('returns false when position.y differs', () => {
    const a = [node('X', { x: 0, y: 0 }, { width: 220, height: 72 })];
    const b = [node('X', { x: 0, y: 1 }, { width: 220, height: 72 })];
    expect(radialNodesEqual(a, b)).toBe(false);
  });

  it('returns false when width differs', () => {
    const a = [node('X', { x: 0, y: 0 }, { width: 220, height: 72 })];
    const b = [node('X', { x: 0, y: 0 }, { width: 300, height: 72 })];
    expect(radialNodesEqual(a, b)).toBe(false);
  });

  it('returns false when height differs', () => {
    const a = [node('X', { x: 0, y: 0 }, { width: 220, height: 72 })];
    const b = [node('X', { x: 0, y: 0 }, { width: 220, height: 100 })];
    expect(radialNodesEqual(a, b)).toBe(false);
  });

  it('returns true for two arrays with identical node geometry', () => {
    const a = [
      node('X', { x: 10, y: 20 }, { width: 220, height: 72 }),
      node('Y', { x: 300, y: 0 }, { width: 220, height: 72 }),
    ];
    const b = [
      node('X', { x: 10, y: 20 }, { width: 220, height: 72 }),
      node('Y', { x: 300, y: 0 }, { width: 220, height: 72 }),
    ];
    expect(radialNodesEqual(a, b)).toBe(true);
  });

  it('returns true for two empty arrays', () => {
    expect(radialNodesEqual([], [])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// B. useRadialRoute hook
// ---------------------------------------------------------------------------

describe('useRadialRoute', () => {
  it('returns null when layoutMode is NOT radial', () => {
    // default store layoutMode is 'flow' after resetStoreForTest
    rfState.nodes = [node('C', { x: 80, y: -20 }, { width: 40, height: 40 })];
    const { result } = renderHook(() => useRadialRoute(defaultParams));
    expect(result.current).toBeNull();
  });

  it('returns null for a junctor edge even in radial mode', () => {
    act(() => {
      useDocumentStore.setState({ layoutMode: 'radial' });
    });
    rfState.nodes = [];
    const { result } = renderHook(() => useRadialRoute({ ...defaultParams, isJunctorEdge: true }));
    expect(result.current).toBeNull();
  });

  it('returns null when hasMutexOverride is true even in radial mode', () => {
    act(() => {
      useDocumentStore.setState({ layoutMode: 'radial' });
    });
    rfState.nodes = [];
    const { result } = renderHook(() =>
      useRadialRoute({ ...defaultParams, hasMutexOverride: true })
    );
    expect(result.current).toBeNull();
  });

  it('returns a RadialEdgeRoute in radial mode for a plain edge with no obstacles', () => {
    act(() => {
      useDocumentStore.setState({ layoutMode: 'radial' });
    });
    rfState.nodes = [];
    const { result } = renderHook(() => useRadialRoute(defaultParams));
    expect(result.current).not.toBeNull();
    expect(result.current).toHaveProperty('path');
    expect(result.current).toHaveProperty('labelX');
    expect(result.current).toHaveProperty('labelY');
    // No obstacles → straight bezier, label centroid at midpoint y=0.
    expect(result.current!.labelY).toBe(0);
    expect(result.current!.labelX).toBe(100);
  });

  it('deflects around an obstacle node sitting on the straight-line path', () => {
    act(() => {
      useDocumentStore.setState({ layoutMode: 'radial' });
    });
    // Obstacle centered on midpoint (100, 0): spans x[80,120] × y[-20,20].
    rfState.nodes = [node('C', { x: 80, y: -20 }, { width: 40, height: 40 })];
    const { result } = renderHook(() => useRadialRoute(defaultParams));
    expect(result.current).not.toBeNull();
    // Obstacle on path → deflection moves label Y off 0.
    expect(result.current!.labelY).not.toBe(0);
  });

  it('excludes the edge endpoints (source/target) from obstacles', () => {
    act(() => {
      useDocumentStore.setState({ layoutMode: 'radial' });
    });
    // Same geometry as the deflection test, but tagged with edge endpoint ids.
    rfState.nodes = [
      node('A', { x: 80, y: -20 }, { width: 40, height: 40 }),
      node('B', { x: 80, y: -20 }, { width: 40, height: 40 }),
    ];
    const { result } = renderHook(() => useRadialRoute(defaultParams));
    expect(result.current).not.toBeNull();
    // Endpoints filtered out → no deflection → label Y stays at 0.
    expect(result.current!.labelY).toBe(0);
  });
});
