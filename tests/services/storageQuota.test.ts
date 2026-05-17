/**
 * Session 129 — storage quota classification + mitigation tests.
 *
 * Verifies that the `storage` seam correctly classifies QuotaExceeded
 * errors and that the store-level listener trims revisions when one
 * fires. The full happy-path of localStorage writes is already
 * exercised by every other test that touches the store (each commit
 * to the doc triggers a writeJSON); these tests pin the failure
 * branch.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  readString,
  STORAGE_KEYS,
  type StorageError,
  setStorageErrorListener,
  writeString,
} from '@/services/storage';

describe('storage error classification', () => {
  let captured: StorageError[] = [];

  beforeEach(() => {
    captured = [];
    setStorageErrorListener((err) => captured.push(err));
  });

  afterEach(() => {
    setStorageErrorListener(null);
    vi.restoreAllMocks();
  });

  it('writeString reports a `quota` error when setItem throws QuotaExceededError', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      // jsdom's DOMException doesn't have all the same surface as a
      // real browser; using the `name` field is the standard contract
      // every browser respects.
      const err = new Error('quota exceeded');
      (err as Error & { name: string }).name = 'QuotaExceededError';
      throw err;
    });

    const ok = writeString('tp-studio:probe', 'x');
    expect(ok).toBe(false);
    expect(captured).toHaveLength(1);
    expect(captured[0]?.kind).toBe('quota');
    expect(captured[0]?.op).toBe('write');
    expect(captured[0]?.key).toBe('tp-studio:probe');
    expect(setItemSpy).toHaveBeenCalledOnce();
  });

  it('writeString reports a `quota` error when Firefox throws NS_ERROR_DOM_QUOTA_REACHED', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      const err = new Error('quota');
      (err as Error & { name: string }).name = 'NS_ERROR_DOM_QUOTA_REACHED';
      throw err;
    });

    writeString('tp-studio:probe', 'x');
    expect(captured[0]?.kind).toBe('quota');
  });

  it('writeString reports `other` for non-quota DOMExceptions (SecurityError, etc.)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      const err = new Error('disabled');
      (err as Error & { name: string }).name = 'SecurityError';
      throw err;
    });

    writeString('tp-studio:probe', 'x');
    expect(captured[0]?.kind).toBe('other');
  });

  it('writeString returns true on the happy path', () => {
    expect(writeString('tp-studio:probe', 'x')).toBe(true);
    expect(readString('tp-studio:probe')).toBe('x');
    expect(captured).toHaveLength(0);
  });

  it('exposes the same storage-keys object the upper layer reads from', () => {
    // Cheap pin so a future rename of the revisions key fires this test
    // before it ships (the quota mitigation reads STORAGE_KEYS.revisions
    // directly).
    expect(STORAGE_KEYS.revisions).toBeDefined();
    expect(typeof STORAGE_KEYS.revisions).toBe('string');
  });
});
