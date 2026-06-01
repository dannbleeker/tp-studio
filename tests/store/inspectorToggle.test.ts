import { beforeEach, describe, expect, it } from 'vitest';
import { resetStoreForTest, useDocumentStore } from '@/store';

/**
 * Backlog quick-win — the TopBar "inspector" toggle force-hides the Inspector
 * panel even when something is selected. These pin the store contract behind
 * the button + the double-click-edge gesture (`showInspector`).
 */

beforeEach(resetStoreForTest);

describe('inspector visibility toggle', () => {
  it('defaults to visible (inspectorHidden = false)', () => {
    expect(useDocumentStore.getState().inspectorHidden).toBe(false);
  });

  it('toggleInspector flips the hidden flag', () => {
    useDocumentStore.getState().toggleInspector();
    expect(useDocumentStore.getState().inspectorHidden).toBe(true);
    useDocumentStore.getState().toggleInspector();
    expect(useDocumentStore.getState().inspectorHidden).toBe(false);
  });

  it('showInspector force-shows it and is idempotent', () => {
    useDocumentStore.getState().toggleInspector(); // hide
    expect(useDocumentStore.getState().inspectorHidden).toBe(true);
    useDocumentStore.getState().showInspector();
    expect(useDocumentStore.getState().inspectorHidden).toBe(false);
    useDocumentStore.getState().showInspector(); // already visible — no-op
    expect(useDocumentStore.getState().inspectorHidden).toBe(false);
  });
});
