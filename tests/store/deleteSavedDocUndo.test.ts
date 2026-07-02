/**
 * Improvement review — deleting a saved tree used to be instant + irreversible.
 * `deleteSavedDoc` now fires an Undo toast whose action re-persists the body,
 * so a misclick is recoverable (symmetric with the app's crash-recovery care).
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { createDocument } from '@/domain/factory';
import { listSavedDocIds } from '@/domain/persistence';
import { resetStoreForTest, useDocumentStore } from '@/store';

const s = () => useDocumentStore.getState();

beforeEach(() => {
  resetStoreForTest();
  localStorage.clear();
});

describe('deleteSavedDoc — Undo toast', () => {
  it('deletes the tree but offers an Undo that restores it', () => {
    const doc = createDocument('crt');
    s().openTab(doc); // persists the body
    s().closeTab(doc.id); // now a closed saved doc in the library
    expect(listSavedDocIds()).toContain(doc.id);

    s().deleteSavedDoc(doc.id);
    // Gone from storage…
    expect(listSavedDocIds()).not.toContain(doc.id);
    // …but an Undo toast is present.
    const toast = s().toasts.find((t) => t.action?.label === 'Undo');
    expect(toast).toBeTruthy();

    toast?.action?.run();
    // Restored.
    expect(listSavedDocIds()).toContain(doc.id);
  });

  it('bumps savedDocsVersion on both the delete and the undo (Start library refresh)', () => {
    const doc = createDocument('frt');
    s().openTab(doc);
    s().closeTab(doc.id);
    const v0 = s().savedDocsVersion;

    s().deleteSavedDoc(doc.id);
    const v1 = s().savedDocsVersion;
    expect(v1).toBeGreaterThan(v0);

    s()
      .toasts.find((t) => t.action?.label === 'Undo')
      ?.action?.run();
    expect(s().savedDocsVersion).toBeGreaterThan(v1);
  });
});
