import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useGraphProjection } from '@/components/canvas/hooks/useGraphProjection';
import type { Group, GroupId } from '@/domain/types';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { makeDoc, makeEntity, resetIds } from '../../domain/helpers';

/**
 * Hoist-scoping branch of `useGraphProjection`. The existing tests in
 * `useGraphProjection.test.tsx` cover the plain-doc / entity-collapse /
 * archived-group / group-collapse paths. This file adds coverage for the
 * `hoistedGroupId` filter path — when a group is hoisted the projection
 * should only surface entities that are descendants of that group.
 */

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

describe('useGraphProjection — hoisted group scope', () => {
  it('restricts visibleEntityIds to descendants of the hoisted group', () => {
    const a = makeEntity();
    const b = makeEntity();
    const outside = makeEntity();
    const doc = makeDoc([a, b, outside], []);
    doc.groups = { g1: group('g1', [a.id, b.id]) };

    // Set hoistedGroupId directly — hoistGroup() validates against the
    // store's live doc; bypass that by writing the store state directly
    // (same pattern as `useDocumentStore.setState({ showArchivedGroups: true })`
    // used in the existing useGraphProjection tests).
    useDocumentStore.setState({ hoistedGroupId: 'g1' });

    const { result } = renderHook(() => useGraphProjection(doc));
    expect(result.current.visibleEntityIds.has(a.id)).toBe(true);
    expect(result.current.visibleEntityIds.has(b.id)).toBe(true);
    // Entity outside the hoisted group must be hidden
    expect(result.current.visibleEntityIds.has(outside.id)).toBe(false);
  });

  it('hoistVisibleGroups only includes the hoisted group itself', () => {
    const a = makeEntity();
    const b = makeEntity();
    const doc = makeDoc([a, b], []);
    doc.groups = {
      g1: group('g1', [a.id]),
      g2: group('g2', [b.id]),
    };

    useDocumentStore.setState({ hoistedGroupId: 'g1' });

    const { result } = renderHook(() => useGraphProjection(doc));
    expect(result.current.hoistVisibleGroups.has('g1')).toBe(true);
    // g2 is outside the hoisted scope
    expect(result.current.hoistVisibleGroups.has('g2')).toBe(false);
  });

  it('unhoist (null) restores all entities to visible', () => {
    const a = makeEntity();
    const b = makeEntity();
    const doc = makeDoc([a, b], []);
    doc.groups = { g1: group('g1', [a.id]) };

    useDocumentStore.setState({ hoistedGroupId: 'g1' });
    useDocumentStore.setState({ hoistedGroupId: null });

    const { result } = renderHook(() => useGraphProjection(doc));
    expect(result.current.visibleEntityIds.has(a.id)).toBe(true);
    expect(result.current.visibleEntityIds.has(b.id)).toBe(true);
    expect(result.current.hoistVisibleGroups.has('g1')).toBe(true);
  });

  it('remap returns null for an entity outside the hoisted scope', () => {
    const a = makeEntity();
    const outside = makeEntity();
    const doc = makeDoc([a, outside], []);
    doc.groups = { g1: group('g1', [a.id]) };

    useDocumentStore.setState({ hoistedGroupId: 'g1' });

    const { result } = renderHook(() => useGraphProjection(doc));
    // Inside the hoist: identity remap
    expect(result.current.remap(a.id)).toBe(a.id);
    // Outside: the entity is not visible → remap returns null
    expect(result.current.remap(outside.id)).toBeNull();
  });
});
