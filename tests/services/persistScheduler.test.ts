import { exportToJSON } from '@/domain/persistence';
import type { TPDocument } from '@/domain/types';
import { PersistScheduler } from '@/services/persistDebounced';
import { STORAGE_KEYS } from '@/services/storage';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { beforeEach, describe, expect, it } from 'vitest';

/**
 * `PersistScheduler` is the class behind `persistDebounced`. The live
 * app uses a module-level singleton (also exported as functions for
 * backward compatibility); these tests instantiate a fresh scheduler so
 * the assertions don't fight other tests' module-level timer state.
 *
 * Key invariants:
 *   - `schedule(doc)` writes the live-draft synchronously and the
 *     committed key after the debounce window.
 *   - `flushNow()` fast-paths the committed write and clears the live
 *     draft.
 *   - `cancel()` clears the timer without writing.
 */

beforeEach(() => {
  resetStoreForTest();
  globalThis.localStorage.clear();
});

const someDoc = (): TPDocument => useDocumentStore.getState().doc;

describe('PersistScheduler', () => {
  it('writes the live draft synchronously on schedule', () => {
    const scheduler = new PersistScheduler();
    const doc = someDoc();
    scheduler.schedule(doc);
    const live = globalThis.localStorage.getItem(STORAGE_KEYS.docLive);
    expect(live).not.toBeNull();
    // The live draft content should match the doc serialization.
    expect(live).toBe(exportToJSON(doc));
    scheduler.cancel();
  });

  it('writes the committed key on flushNow and clears the live draft', () => {
    const scheduler = new PersistScheduler();
    const doc = someDoc();
    scheduler.schedule(doc);
    expect(globalThis.localStorage.getItem(STORAGE_KEYS.doc)).toBeNull();
    scheduler.flushNow();
    expect(globalThis.localStorage.getItem(STORAGE_KEYS.doc)).toBe(exportToJSON(doc));
    expect(globalThis.localStorage.getItem(STORAGE_KEYS.docLive)).toBeNull();
  });

  it('cancel() prevents the pending committed write', async () => {
    const scheduler = new PersistScheduler();
    scheduler.schedule(someDoc());
    scheduler.cancel();
    // Wait past the debounce window to make sure no late write fires.
    await new Promise((r) => setTimeout(r, 250));
    expect(globalThis.localStorage.getItem(STORAGE_KEYS.doc)).toBeNull();
  });

  it('two schedulers maintain independent state', () => {
    const a = new PersistScheduler();
    const b = new PersistScheduler();
    a.schedule(someDoc());
    // b.cancel() must not affect a's pending write.
    b.cancel();
    a.flushNow();
    expect(globalThis.localStorage.getItem(STORAGE_KEYS.doc)).not.toBeNull();
  });

  it('flushNow with nothing pending is a safe no-op', () => {
    const scheduler = new PersistScheduler();
    expect(() => scheduler.flushNow()).not.toThrow();
    expect(globalThis.localStorage.getItem(STORAGE_KEYS.doc)).toBeNull();
  });
});
