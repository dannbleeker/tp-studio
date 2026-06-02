import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetHandleStoreForTests,
  getLinkedFile,
  linkFile,
  subscribeLinkChange,
  unlinkFile,
} from '@/services/storage/fileHandles';

/**
 * jsdom has no IndexedDB, so the store transparently uses its in-memory
 * fallback here — which is exactly the public-API contract we want to pin.
 * (The IndexedDB adapter is a thin standard-API wrapper exercised manually in
 * Chrome/Edge.) `__resetHandleStoreForTests` gives each case a fresh map.
 */

const fakeHandle = (name: string): FileSystemFileHandle =>
  ({ name }) as unknown as FileSystemFileHandle;

beforeEach(__resetHandleStoreForTests);

describe('fileHandles link store', () => {
  it('returns null for an unlinked document', async () => {
    expect(await getLinkedFile('doc-x')).toBeNull();
  });

  it('links a handle and reads it back with its name', async () => {
    await linkFile('doc-1', fakeHandle('budget.tps.json'));
    const linked = await getLinkedFile('doc-1');
    expect(linked?.name).toBe('budget.tps.json');
    expect(linked?.handle).toBeDefined();
  });

  it('keys links independently per document id', async () => {
    await linkFile('doc-1', fakeHandle('a.json'));
    await linkFile('doc-2', fakeHandle('b.json'));
    expect((await getLinkedFile('doc-1'))?.name).toBe('a.json');
    expect((await getLinkedFile('doc-2'))?.name).toBe('b.json');
  });

  it('overwrites an existing link', async () => {
    await linkFile('doc-1', fakeHandle('old.json'));
    await linkFile('doc-1', fakeHandle('new.json'));
    expect((await getLinkedFile('doc-1'))?.name).toBe('new.json');
  });

  it('unlinks a document', async () => {
    await linkFile('doc-1', fakeHandle('a.json'));
    await unlinkFile('doc-1');
    expect(await getLinkedFile('doc-1')).toBeNull();
  });

  it('notifies subscribers on link + unlink, and stops after unsubscribe', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeLinkChange(listener);
    await linkFile('doc-1', fakeHandle('a.json'));
    await unlinkFile('doc-1');
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    await linkFile('doc-2', fakeHandle('b.json'));
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
