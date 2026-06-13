/**
 * Session 185 — `evictOldestClosedTrees` is the final tier of the localStorage
 * quota cascade: when trimming revisions and dropping backups freed nothing, it
 * removes the oldest CLOSED saved trees (never an open tab) to keep the app
 * saving. These pin the ordering, the open-tab exclusion, and the batch cap.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { createDocument } from '@/domain/factory';
import {
  evictOldestClosedTrees,
  listSavedDocIds,
  saveDocToLocalStorage,
} from '@/domain/persistence';

beforeEach(() => localStorage.clear());

const saveAt = (updatedAt: number): string => {
  const doc = { ...createDocument('crt'), updatedAt };
  saveDocToLocalStorage(doc);
  return doc.id;
};

describe('evictOldestClosedTrees', () => {
  it('evicts the oldest CLOSED trees first, keeps open ones, respects the batch', () => {
    const oldestClosed = saveAt(100);
    const midClosed = saveAt(200);
    const newestClosed = saveAt(300);
    const openButOldest = saveAt(50); // oldest of all, but OPEN → must never be evicted
    expect(listSavedDocIds().sort()).toEqual(
      [oldestClosed, midClosed, newestClosed, openButOldest].sort()
    );

    const evicted = evictOldestClosedTrees(new Set([openButOldest]), 2);
    expect(evicted).toBe(2);

    const remaining = listSavedDocIds();
    expect(remaining).toContain(openButOldest); // open kept despite being the oldest
    expect(remaining).toContain(newestClosed); // newest closed survives a batch of 2
    expect(remaining).not.toContain(oldestClosed);
    expect(remaining).not.toContain(midClosed);
  });

  it('evicts nothing when every saved tree is open', () => {
    const id = saveAt(1);
    expect(evictOldestClosedTrees(new Set([id]), 5)).toBe(0);
    expect(listSavedDocIds()).toContain(id);
  });

  it('caps at the available closed trees when the batch exceeds the set', () => {
    saveAt(1);
    saveAt(2);
    expect(evictOldestClosedTrees(new Set(), 99)).toBe(2);
    expect(listSavedDocIds()).toHaveLength(0);
  });
});
