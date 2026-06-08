import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDocument } from '@/domain/factory';
import { resetStoreForTest, useDocumentStore } from '@/store';
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

  it('clears compare + side-by-side when switching to another tab', () => {
    // Regression: compare/side-by-side are per-doc views of a revision in the
    // CURRENT doc's history. A tab switch used to leave the entering tab stuck
    // in a ghost compare state (its revisions no longer hold the compared id).
    const s = () => useDocumentStore.getState();
    const firstId = s().activeDocId;
    s().openTab(createDocument('crt')); // open + switch to a second tab
    s().openCompare('rev-from-tab-2');
    s().openSideBySide('rev-from-tab-2');
    expect(s().compareRevisionId).toBe('rev-from-tab-2');
    s().switchTab(firstId); // back to the first tab
    expect(s().compareRevisionId).toBeNull();
    expect(s().sideBySideRevisionId).toBeNull();
  });

  it('clears compare when opening a new tab', () => {
    const s = () => useDocumentStore.getState();
    s().openCompare('rev-x');
    expect(s().compareRevisionId).toBe('rev-x');
    s().openTab(createDocument('frt'));
    expect(s().compareRevisionId).toBeNull();
  });
});
