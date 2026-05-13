import { resetStoreForTest, useDocumentStore } from '@/store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seedEntity } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);
afterEach(resetStoreForTest);

describe('H2/H4 — compare and side-by-side store actions', () => {
  it('compareRevisionId and sideBySideRevisionId default to null', () => {
    const s = useDocumentStore.getState();
    expect(s.compareRevisionId).toBeNull();
    expect(s.sideBySideRevisionId).toBeNull();
  });

  it('openCompare / closeCompare set + clear compareRevisionId', () => {
    useDocumentStore.getState().openCompare('rev-123');
    expect(useDocumentStore.getState().compareRevisionId).toBe('rev-123');
    useDocumentStore.getState().closeCompare();
    expect(useDocumentStore.getState().compareRevisionId).toBeNull();
  });

  it('openSideBySide / closeSideBySide manage sideBySideRevisionId independently', () => {
    useDocumentStore.getState().openSideBySide('rev-abc');
    expect(useDocumentStore.getState().sideBySideRevisionId).toBe('rev-abc');
    // compare mode is unaffected.
    expect(useDocumentStore.getState().compareRevisionId).toBeNull();
    useDocumentStore.getState().closeSideBySide();
    expect(useDocumentStore.getState().sideBySideRevisionId).toBeNull();
  });

  it('both modes can be active at once (compare overlay + side-by-side dialog)', () => {
    seedEntity('A');
    const s = useDocumentStore.getState();
    const id = s.captureSnapshot('Baseline');
    s.openCompare(id);
    s.openSideBySide(id);
    expect(useDocumentStore.getState().compareRevisionId).toBe(id);
    expect(useDocumentStore.getState().sideBySideRevisionId).toBe(id);
  });
});
