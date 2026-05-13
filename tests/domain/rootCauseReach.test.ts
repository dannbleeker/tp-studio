import { rootCauseReachCounts } from '@/domain/coreDriver';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { beforeEach, describe, expect, it } from 'vitest';
import { seedEntity } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);

/**
 * E2 — reverse-reach badge: counts how many root causes transitively
 * feed an entity. Mirror of `udeReachCounts`, using backward BFS.
 *
 * The function is pure; tests drive it by constructing simple graphs
 * via the store actions and reading the result map.
 */

describe('rootCauseReachCounts', () => {
  it('returns empty when no root causes exist', () => {
    seedEntity('Lonely effect', 'effect');
    const counts = rootCauseReachCounts(useDocumentStore.getState().doc);
    expect(counts.size).toBe(0);
  });

  it('counts a single root cause feeding one effect', () => {
    const rc = seedEntity('RC', 'rootCause');
    const eff = seedEntity('Effect', 'effect');
    useDocumentStore.getState().connect(rc.id, eff.id);
    const counts = rootCauseReachCounts(useDocumentStore.getState().doc);
    expect(counts.get(eff.id)).toBe(1);
  });

  it('two root causes converging on one effect → count is 2', () => {
    const a = seedEntity('A', 'rootCause');
    const b = seedEntity('B', 'rootCause');
    const eff = seedEntity('Effect', 'effect');
    useDocumentStore.getState().connect(a.id, eff.id);
    useDocumentStore.getState().connect(b.id, eff.id);
    const counts = rootCauseReachCounts(useDocumentStore.getState().doc);
    expect(counts.get(eff.id)).toBe(2);
  });

  it('omits root-cause entities themselves (no self-counting)', () => {
    const rc = seedEntity('RC', 'rootCause');
    const eff = seedEntity('Effect', 'effect');
    useDocumentStore.getState().connect(rc.id, eff.id);
    const counts = rootCauseReachCounts(useDocumentStore.getState().doc);
    expect(counts.get(rc.id)).toBeUndefined();
  });

  it('transitively counts root causes through intermediate effects', () => {
    const rc = seedEntity('RC', 'rootCause');
    const mid = seedEntity('Mid', 'effect');
    const top = seedEntity('Top', 'effect');
    useDocumentStore.getState().connect(rc.id, mid.id);
    useDocumentStore.getState().connect(mid.id, top.id);
    const counts = rootCauseReachCounts(useDocumentStore.getState().doc);
    // Top is fed by RC through Mid.
    expect(counts.get(top.id)).toBe(1);
    expect(counts.get(mid.id)).toBe(1);
  });
});
