import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useGraphProjection } from '@/components/canvas/hooks/useGraphProjection';
import type { Group, GroupId } from '@/domain/types';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { makeDoc, makeEdge, makeEntity, resetIds } from '../../domain/helpers';

const group = (id: string, memberIds: string[], over: Partial<Group> = {}): Group => ({
  id: id as GroupId,
  title: id,
  color: 'indigo',
  memberIds,
  collapsed: false,
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

beforeEach(() => {
  resetStoreForTest();
  resetIds();
});

describe('useGraphProjection', () => {
  it('passes all entities through on a plain doc (identity remap)', () => {
    const a = makeEntity();
    const b = makeEntity();
    const doc = makeDoc([a, b], [makeEdge(a.id, b.id)]);
    const { result } = renderHook(() => useGraphProjection(doc));
    expect(result.current.visibleEntityIds).toEqual(new Set([a.id, b.id]));
    expect(result.current.remap(a.id)).toBe(a.id);
    expect(result.current.visibleCollapsedRoots).toEqual([]);
  });

  it('F7 entity-collapse hides the downstream + reports the hidden count', () => {
    const a = makeEntity({ collapsed: true });
    const b = makeEntity();
    const c = makeEntity();
    const doc = makeDoc([a, b, c], [makeEdge(a.id, b.id), makeEdge(b.id, c.id)]);
    const { result } = renderHook(() => useGraphProjection(doc));
    expect(result.current.visibleEntityIds.has(a.id)).toBe(true); // the collapser stays
    expect(result.current.visibleEntityIds.has(b.id)).toBe(false);
    expect(result.current.visibleEntityIds.has(c.id)).toBe(false);
    expect(result.current.hiddenCountByCollapser.get(a.id)).toBe(2);
  });

  it('hides entities inside an archived group when showArchivedGroups is off', () => {
    const a = makeEntity();
    const b = makeEntity();
    const doc = makeDoc([a, b], []);
    doc.groups = { g1: group('g1', [a.id], { archived: true }) };
    const { result } = renderHook(() => useGraphProjection(doc));
    expect(result.current.visibleEntityIds.has(a.id)).toBe(false);
    expect(result.current.visibleEntityIds.has(b.id)).toBe(true);
    expect(result.current.hoistVisibleGroups.has('g1')).toBe(false);
  });

  it('keeps the archived group visible when showArchivedGroups is on', () => {
    const a = makeEntity();
    const doc = makeDoc([a], []);
    doc.groups = { g1: group('g1', [a.id], { archived: true }) };
    useDocumentStore.setState({ showArchivedGroups: true });
    const { result } = renderHook(() => useGraphProjection(doc));
    expect(result.current.visibleEntityIds.has(a.id)).toBe(true);
  });

  it('remaps a collapsed group member to the collapsed root', () => {
    const a = makeEntity();
    const b = makeEntity();
    const doc = makeDoc([a, b], [makeEdge(a.id, b.id)]);
    doc.groups = { g1: group('g1', [a.id, b.id], { collapsed: true }) };
    const { result } = renderHook(() => useGraphProjection(doc));
    expect(result.current.visibleEntityIds.has(a.id)).toBe(false);
    expect(result.current.visibleCollapsedRoots).toContain('g1');
    expect(result.current.remap(a.id)).toBe('g1');
  });
});
