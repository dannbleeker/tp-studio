import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the Chromium-only File System Access primitives so the orchestration
// (permission → write → re-stamp → unlink-on-failure) is exercised in jsdom.
vi.mock('@/services/fileSystemAccess', () => ({
  ensureWritePermission: vi.fn(),
  writeTextToHandle: vi.fn(),
}));

import { ensureWritePermission, writeTextToHandle } from '@/services/fileSystemAccess';
import { saveToLinkedFile } from '@/services/saveToLinkedFile';
import {
  __resetHandleStoreForTests,
  getLinkedFile,
  linkFile,
} from '@/services/storage/fileHandles';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';

const mockPermit = vi.mocked(ensureWritePermission);
const mockWrite = vi.mocked(writeTextToHandle);
const fakeHandle = (name: string): FileSystemFileHandle =>
  ({ name }) as unknown as FileSystemFileHandle;

const s = () => useDocumentStore.getState();
const docId = () => currentDoc(s()).id;

beforeEach(() => {
  resetStoreForTest();
  __resetHandleStoreForTests();
  mockPermit.mockReset();
  mockWrite.mockReset();
});
afterEach(() => vi.clearAllMocks());

describe('saveToLinkedFile', () => {
  it('returns no-link when the doc has no linked file', async () => {
    expect(await saveToLinkedFile(s())).toBe('no-link');
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('writes through, re-stamps savedAt, and toasts on success', async () => {
    mockPermit.mockResolvedValue(true);
    mockWrite.mockResolvedValue(undefined);
    await linkFile(docId(), fakeHandle('budget.tps.json'), 1000);

    const result = await saveToLinkedFile(s());

    expect(result).toBe('saved');
    expect(mockWrite).toHaveBeenCalledOnce();
    // savedAt re-stamped to "now" (>> the seeded 1000) so the dirty chip clears.
    expect((await getLinkedFile(docId()))?.savedAt).toBeGreaterThan(1000);
    expect(s().toasts.some((t) => /Saved to budget\.tps\.json/.test(t.message))).toBe(true);
  });

  it('returns permission-denied without writing when permission is refused', async () => {
    mockPermit.mockResolvedValue(false);
    await linkFile(docId(), fakeHandle('x.json'));
    expect(await saveToLinkedFile(s())).toBe('permission-denied');
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('drops the link and returns error when the write throws', async () => {
    mockPermit.mockResolvedValue(true);
    mockWrite.mockRejectedValue(new Error('file gone'));
    await linkFile(docId(), fakeHandle('x.json'));

    expect(await saveToLinkedFile(s())).toBe('error');
    expect(await getLinkedFile(docId())).toBeNull(); // link dropped so next save re-picks
    expect(s().toasts.some((t) => t.kind === 'error')).toBe(true);
  });
});
