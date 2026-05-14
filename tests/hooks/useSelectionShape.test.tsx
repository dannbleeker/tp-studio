import { useSelectionShape } from '@/hooks/useSelectionShape';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seedEntity } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);
afterEach(cleanup);

/**
 * Direct unit coverage for the selection-shape derivation hook. The logic
 * used to live inline in `Inspector.tsx` as a chain of ternaries; extracting
 * it (Session 39, #6 from the next-batch top-10) lets each derived field
 * be pinned per selection state without going through the full Inspector
 * render.
 */

describe('useSelectionShape', () => {
  it('reports the empty / closed shape when nothing is selected', () => {
    const { result } = renderHook(() => useSelectionShape());
    expect(result.current.open).toBe(false);
    expect(result.current.singleId).toBeUndefined();
    expect(result.current.isMulti).toBe(false);
    expect(result.current.isSingleGroup).toBe(false);
    expect(result.current.headerLabel).toBe('');
  });

  it('reports Entity when a single non-group entity is selected', () => {
    const e = seedEntity('A');
    act(() => useDocumentStore.getState().selectEntity(e.id));
    const { result } = renderHook(() => useSelectionShape());
    expect(result.current.open).toBe(true);
    expect(result.current.singleId).toBe(e.id);
    expect(result.current.isMulti).toBe(false);
    expect(result.current.isSingleGroup).toBe(false);
    expect(result.current.headerLabel).toBe('Entity');
  });

  it('reports Group when a single group id is selected', () => {
    const e = seedEntity('A');
    const g = useDocumentStore.getState().createGroupFromSelection([e.id], { title: 'G' });
    if (!g) throw new Error('group not created');
    // Session 85 (#1) — `selectGroup` brands the id correctly into the
    // new `Selection` `groups` variant. Previously this test went through
    // `selectEntity(g.id)` and relied on `useSelectionShape` detecting
    // group-ness via a `groups[id]` lookup.
    act(() => useDocumentStore.getState().selectGroup(g.id));
    const { result } = renderHook(() => useSelectionShape());
    expect(result.current.isSingleGroup).toBe(true);
    expect(result.current.headerLabel).toBe('Group');
  });

  it('reports the count when multiple entities are selected', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    act(() => useDocumentStore.getState().selectEntities([a.id, b.id]));
    const { result } = renderHook(() => useSelectionShape());
    expect(result.current.isMulti).toBe(true);
    expect(result.current.singleId).toBeUndefined();
    expect(result.current.headerLabel).toBe('2 entities');
  });

  it('reports the count when multiple edges are selected', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const c = seedEntity('C');
    const e1 = useDocumentStore.getState().connect(a.id, c.id);
    const e2 = useDocumentStore.getState().connect(b.id, c.id);
    if (!e1 || !e2) throw new Error('connect failed');
    act(() => useDocumentStore.getState().selectEdges([e1.id, e2.id]));
    const { result } = renderHook(() => useSelectionShape());
    expect(result.current.isMulti).toBe(true);
    expect(result.current.headerLabel).toBe('2 edges');
  });
});
