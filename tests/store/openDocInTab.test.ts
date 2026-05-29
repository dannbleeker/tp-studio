/**
 * Multi-doc tabs Phase 5, Batch 5.3 — load-routing + the open-in-new-tab
 * preference.
 *
 * `openDocInTab(doc)` is the seam every "open a different document" surface
 * (import / pattern / template / example / share-link / spawn-EC) routes
 * through. It honours the persisted `openDocsInNewTab` preference: a new tab
 * when on (the default, decision #6), a replace-in-place when off, returning
 * which path it took so callers can tailor their post-load toast.
 *
 * The persistence round-trip exercises the full prefs plumbing (setter →
 * snapshot → writePrefs → readInitialPrefs); a missed spot in that chain
 * surfaces here as a failed reload assertion.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { createDocument } from '@/domain/factory';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { readInitialPrefs } from '@/store/uiSlice/prefs';

const s = () => useDocumentStore.getState();
const docNamed = (title: string) => ({ ...createDocument('frt'), title });

beforeEach(() => {
  resetStoreForTest();
  localStorage.clear();
});

describe('Batch 5.3 — openDocInTab + open-in-new-tab preference', () => {
  it('defaults the preference to ON (new-tab mode)', () => {
    expect(s().openDocsInNewTab).toBe(true);
  });

  it('opens a loaded doc in a NEW tab when the pref is on, keeping the current tab', () => {
    s().setTitle('Original');
    const firstId = s().activeDocId;
    const loaded = docNamed('Loaded');

    const openedNewTab = s().openDocInTab(loaded);

    expect(openedNewTab).toBe(true);
    expect(s().tabOrder).toHaveLength(2);
    expect(s().tabOrder).toContain(firstId); // the original tab survives
    expect(s().activeDocId).toBe(loaded.id); // …and the new tab is active
    expect(s().doc.title).toBe('Loaded');
    // The original is still reachable in its own tab.
    expect(s().docs[firstId]?.title).toBe('Original');
  });

  it('replaces the active document (no new tab) when the pref is off', () => {
    s().setOpenDocsInNewTab(false);
    s().setTitle('Original');
    const loaded = docNamed('Loaded');

    const openedNewTab = s().openDocInTab(loaded);

    expect(openedNewTab).toBe(false);
    expect(s().tabOrder).toHaveLength(1);
    expect(s().doc.title).toBe('Loaded');
  });

  it('persists the preference across reloads (round-trips through localStorage)', () => {
    // Fresh install (no stored value) defaults to true via `!== false`.
    expect(readInitialPrefs().openDocsInNewTab).toBe(true);

    s().setOpenDocsInNewTab(false);
    expect(readInitialPrefs().openDocsInNewTab).toBe(false);

    s().setOpenDocsInNewTab(true);
    expect(readInitialPrefs().openDocsInNewTab).toBe(true);
  });

  it('reset-to-defaults restores the new-tab default', () => {
    s().setOpenDocsInNewTab(false);
    expect(s().openDocsInNewTab).toBe(false);
    s().resetPreferencesToDefaults();
    expect(s().openDocsInNewTab).toBe(true);
  });
});
