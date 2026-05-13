import { guardWriteOrToast, isBrowseLocked } from '@/services/browseLock';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { beforeEach, describe, expect, it } from 'vitest';

beforeEach(resetStoreForTest);

describe('browseLock guard', () => {
  it('passes through when not locked', () => {
    expect(isBrowseLocked()).toBe(false);
    expect(guardWriteOrToast()).toBe(true);
    expect(useDocumentStore.getState().toasts).toHaveLength(0);
  });

  it('blocks and toasts when locked', () => {
    useDocumentStore.getState().setBrowseLocked(true);
    expect(isBrowseLocked()).toBe(true);
    expect(guardWriteOrToast()).toBe(false);
    const toasts = useDocumentStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]!.message).toMatch(/Browse Lock/);
  });

  it('resumes passing through after unlock', () => {
    useDocumentStore.getState().setBrowseLocked(true);
    expect(guardWriteOrToast()).toBe(false);
    useDocumentStore.getState().setBrowseLocked(false);
    expect(guardWriteOrToast()).toBe(true);
  });
});
