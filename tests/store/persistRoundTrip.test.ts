import { loadFromLocalStorage } from '@/domain/persistence';
import { flushPersist } from '@/services/persistDebounced';
import { STORAGE_KEYS } from '@/services/storage';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { beforeEach, describe, expect, it } from 'vitest';
import { seedConnectedPair, seedEntity } from '../helpers/seedDoc';

beforeEach(() => {
  resetStoreForTest();
  globalThis.localStorage.clear();
});

/**
 * End-to-end persistence: edit → flush debounce → load from
 * localStorage → assert the doc round-trips. The individual layers are
 * tested elsewhere (`persistence.test.ts` for the JSON shape,
 * `persistScheduler.test.ts` for the timer behaviour); this file proves
 * they compose correctly.
 *
 * The mid-keystroke "live draft" path (A5 auto-recovery) gets its own
 * test: live draft + no committed doc → load returns the live draft.
 */

describe('persist round-trip', () => {
  it('schedules a debounced write that loadFromLocalStorage can read', () => {
    seedEntity('Hello');
    seedConnectedPair('Cause', 'Effect');
    // Debounce + flush so the localStorage write commits synchronously.
    flushPersist();
    const loaded = loadFromLocalStorage();
    expect(loaded).not.toBeNull();
    if (!loaded) return;
    // Same entity count, same structure.
    expect(Object.keys(loaded.entities).length).toBe(
      Object.keys(useDocumentStore.getState().doc.entities).length
    );
    expect(Object.keys(loaded.edges).length).toBe(
      Object.keys(useDocumentStore.getState().doc.edges).length
    );
    expect(loaded.diagramType).toBe(useDocumentStore.getState().doc.diagramType);
  });

  it('preserves title, author, and description across the round-trip', () => {
    seedEntity('A');
    const state = useDocumentStore.getState();
    state.setTitle('My CRT');
    state.setDocumentMeta({ author: 'Jane', description: 'Quarterly review' });
    flushPersist();
    const loaded = loadFromLocalStorage();
    expect(loaded?.title).toBe('My CRT');
    expect(loaded?.author).toBe('Jane');
    expect(loaded?.description).toBe('Quarterly review');
  });

  it('live-draft path: when only the live draft exists, it wins', () => {
    seedEntity('LiveDraft');
    // Don't flush — the live draft is written synchronously by
    // persistDebounced, the committed key is still empty.
    expect(globalThis.localStorage.getItem(STORAGE_KEYS.doc)).toBeNull();
    expect(globalThis.localStorage.getItem(STORAGE_KEYS.docLive)).not.toBeNull();
    const loaded = loadFromLocalStorage();
    expect(loaded).not.toBeNull();
    expect(Object.values(loaded?.entities ?? {}).some((e) => e.title === 'LiveDraft')).toBe(true);
  });

  it('preserves pinned positions across the round-trip', () => {
    const e = seedEntity('Pinned');
    useDocumentStore.getState().setEntityPosition(e.id, { x: 123, y: 456 });
    flushPersist();
    const loaded = loadFromLocalStorage();
    const reloaded = Object.values(loaded?.entities ?? {}).find((x) => x.title === 'Pinned');
    expect(reloaded?.position).toEqual({ x: 123, y: 456 });
  });
});
