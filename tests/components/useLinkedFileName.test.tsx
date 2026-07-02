import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useLinkedFileStatus } from '@/components/toolbar/useLinkedFileName';
import { __resetHandleStoreForTests, linkFile, unlinkFile } from '@/services/storage/fileHandles';

/** Drives the hook against the real (in-memory, jsdom) link store, so the
 *  subscribe-and-refresh wiring is exercised end to end. */

const fakeHandle = (name: string): FileSystemFileHandle =>
  ({ name }) as unknown as FileSystemFileHandle;

beforeEach(__resetHandleStoreForTests);

describe('useLinkedFileStatus', () => {
  it('is null for an unlinked document', async () => {
    const { result } = renderHook(() => useLinkedFileStatus('doc-x'));
    await waitFor(() => expect(result.current).toBeNull());
  });

  it('reflects a linked file (name + savedAt) and updates when it is cleared', async () => {
    await linkFile('doc-1', fakeHandle('budget.tps.json'), 1234);
    const { result } = renderHook(() => useLinkedFileStatus('doc-1'));
    await waitFor(() => expect(result.current).toEqual({ name: 'budget.tps.json', savedAt: 1234 }));
    await act(async () => {
      await unlinkFile('doc-1');
    });
    await waitFor(() => expect(result.current).toBeNull());
  });

  it('switches when the docId changes', async () => {
    await linkFile('doc-1', fakeHandle('a.json'));
    await linkFile('doc-2', fakeHandle('b.json'));
    const { result, rerender } = renderHook(({ id }) => useLinkedFileStatus(id), {
      initialProps: { id: 'doc-1' },
    });
    await waitFor(() => expect(result.current?.name).toBe('a.json'));
    rerender({ id: 'doc-2' });
    await waitFor(() => expect(result.current?.name).toBe('b.json'));
  });
});
