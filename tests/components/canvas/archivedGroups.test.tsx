import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useGraphProjection } from '@/components/canvas/hooks/useGraphProjection';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../../helpers/seedDoc';

/**
 * Session 135 medium gap — "preserve rejected logic in collapsed
 * groups". An archived group + everything transitively inside it drops
 * out of the visible projection unless the `showArchivedGroups`
 * preference is on. These tests pin the projection-level behaviour
 * (the load-bearing part — the UI just toggles the flag + the pref).
 */

beforeEach(resetStoreForTest);
afterEach(cleanup);

const s = () => useDocumentStore.getState();

/** Seed two entities, put the first in a group, return both ids + the
 *  group id. The group starts un-archived. */
const seedGroupedPair = () => {
  const a = seedEntity('Rejected cause');
  const b = seedEntity('Live effect');
  const g = s().createGroupFromSelection([a.id]);
  if (!g) throw new Error('createGroupFromSelection failed');
  return { aId: a.id, bId: b.id, groupId: g.id };
};

describe('archived groups — projection visibility', () => {
  it('hides an archived group + its members when showArchivedGroups is off (default)', () => {
    const { aId, bId, groupId } = seedGroupedPair();
    s().toggleGroupArchived(groupId);
    // Default pref is false.
    expect(s().showArchivedGroups).toBe(false);

    const { result } = renderHook(() => useGraphProjection(s().doc));
    // The archived member drops out; the un-grouped entity stays.
    expect(result.current.visibleEntityIds.has(aId)).toBe(false);
    expect(result.current.visibleEntityIds.has(bId)).toBe(true);
    // The archived group itself is not in the visible-group set.
    expect(result.current.hoistVisibleGroups.has(groupId)).toBe(false);
  });

  it('reveals the archived group + members when showArchivedGroups is on', () => {
    const { aId, bId, groupId } = seedGroupedPair();
    s().toggleGroupArchived(groupId);
    s().setShowArchivedGroups(true);

    const { result } = renderHook(() => useGraphProjection(s().doc));
    expect(result.current.visibleEntityIds.has(aId)).toBe(true);
    expect(result.current.visibleEntityIds.has(bId)).toBe(true);
    expect(result.current.hoistVisibleGroups.has(groupId)).toBe(true);
  });

  it('an un-archived group is always visible regardless of the pref', () => {
    const { aId, groupId } = seedGroupedPair();
    // Never archived.
    const { result } = renderHook(() => useGraphProjection(s().doc));
    expect(result.current.visibleEntityIds.has(aId)).toBe(true);
    expect(result.current.hoistVisibleGroups.has(groupId)).toBe(true);
  });

  it('un-archiving restores visibility', () => {
    const { aId, groupId } = seedGroupedPair();
    s().toggleGroupArchived(groupId); // archive
    s().toggleGroupArchived(groupId); // un-archive
    const { result } = renderHook(() => useGraphProjection(s().doc));
    expect(result.current.visibleEntityIds.has(aId)).toBe(true);
  });
});
