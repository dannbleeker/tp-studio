import { useGraphPositions } from '@/components/canvas/useGraphPositions';
import type { GraphProjection } from '@/components/canvas/useGraphProjection';
import { createDocument } from '@/domain/factory';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * Session 85 / #16 — direct coverage for `useGraphPositions`. The hook
 * branches three ways:
 *
 *   - **Manual layout** (Evaporating Cloud) reads positions straight from
 *     `entity.position` — synchronous, no dagre.
 *   - **Radial layout** runs the hand-rolled radial algorithm — also
 *     synchronous.
 *   - **Dagre layout** lazy-loads `@/domain/layout` via `await import()`
 *     and only populates positions after the effect resolves.
 *
 * The async branch is the one most likely to regress invisibly: a
 * dependency-array typo or a missing `setDagreState` call would surface
 * as "blank canvas on cold load" — easy to miss in dev (the module is
 * already cached after the first run) and easy to miss in CI without a
 * test that exercises the cold path. The tests below pin both branches:
 *
 *   1. EC doc → positions present synchronously on first render.
 *   2. CRT doc → first render returns an empty map, but `waitFor`
 *      observes populated positions after the dynamic import settles.
 */

/** Build a minimal `GraphProjection` that mirrors what `useGraphProjection`
 *  would produce for a no-groups, no-collapse doc. Identity remap, empty
 *  collapse sets — enough surface area for `useGraphPositions` to run. */
const projectionFor = (entityIds: string[]): GraphProjection => ({
  proj: {
    collapsedRoots: new Set<string>(),
    groupOfEntity: new Map<string, string>(),
    entityCollapseRoot: new Map<string, string>(),
  } as unknown as GraphProjection['proj'],
  visibleEntityIds: new Set(entityIds),
  visibleCollapsedRoots: [],
  hoistVisibleGroups: new Set<string>(),
  remap: (id: string) => id,
  hiddenCountByCollapser: new Map<string, number>(),
});

beforeEach(resetStoreForTest);
afterEach(cleanup);

describe('useGraphPositions', () => {
  it('returns synchronous positions for an EC doc (manual layout)', () => {
    // EC seeds 5 boxes at canonical coordinates — they should appear on
    // the very first render without waiting for any async work.
    useDocumentStore.setState({ doc: createDocument('ec') });
    const doc = useDocumentStore.getState().doc;
    const entityIds = Object.keys(doc.entities);
    const projection = projectionFor(entityIds);

    const { result } = renderHook(() => useGraphPositions(doc, projection));

    expect(Object.keys(result.current).length).toBe(entityIds.length);
    for (const id of entityIds) {
      const pos = result.current[id];
      expect(pos).toBeDefined();
      expect(typeof pos!.x).toBe('number');
      expect(typeof pos!.y).toBe('number');
    }
  });

  it('hydrates positions asynchronously for a CRT doc (lazy dagre path)', async () => {
    // CRT has no manual positions — the hook should kick off the dagre
    // import and replace its initial empty-positions snapshot once the
    // module resolves.
    const seedDoc = createDocument('crt');
    const { addEntity, connect } = useDocumentStore.getState();
    useDocumentStore.setState({ doc: seedDoc });
    const a = addEntity({ type: 'effect', title: 'Cause' });
    const b = addEntity({ type: 'effect', title: 'Effect' });
    connect(a.id, b.id);
    const doc = useDocumentStore.getState().doc;
    const projection = projectionFor([a.id, b.id]);

    const { result } = renderHook(() => useGraphPositions(doc, projection));

    // The dagre module is loaded once per test run. If a previous test
    // already warmed the cache, the effect resolves in a single
    // microtask; if not, `waitFor` polls until it does. Either way, the
    // hook must eventually return both entity positions.
    await waitFor(() => {
      expect(Object.keys(result.current).sort()).toEqual([a.id, b.id].sort());
    });
    expect(typeof result.current[a.id]!.x).toBe('number');
    expect(typeof result.current[b.id]!.y).toBe('number');
  });
});
