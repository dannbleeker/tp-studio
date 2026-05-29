/**
 * Multi-doc tabs Phase 5, Batch 5.3 — end-to-end load routing.
 *
 * Drives a representative "open a document" surface (the pattern library)
 * through the UI to prove the reroute wiring: clicking a pattern card calls
 * `openDocInTab`, which honours the `openDocsInNewTab` preference. The
 * store-level contract is covered in `tests/store/openDocInTab.test.ts`;
 * this guards the dialog → store hookup so a dropped hook can't regress
 * silently.
 */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PatternLibraryDialog } from '@/components/patterns/PatternLibraryDialog';
import { PATTERNS } from '@/domain/patterns';
import { resetStoreForTest, useDocumentStore } from '@/store';

const s = () => useDocumentStore.getState();
const firstPattern = () => {
  const p = PATTERNS[0];
  if (!p) throw new Error('no patterns registered');
  return p;
};

beforeEach(() => {
  resetStoreForTest();
  localStorage.clear();
});
afterEach(cleanup);

describe('Batch 5.3 — loading a document routes to a new tab', () => {
  it('clicking a pattern opens it in a new tab (default), keeping the current doc', () => {
    s().setTitle('My work');
    const firstId = s().activeDocId;
    act(() => {
      s().openPatternLibrary();
    });
    render(<PatternLibraryDialog />);

    const pattern = firstPattern();
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: `Load pattern: ${pattern.label}` }));
    });

    expect(s().tabOrder).toHaveLength(2);
    expect(s().tabOrder).toContain(firstId);
    expect(s().docs[firstId]?.title).toBe('My work'); // original survives
  });

  it('with the pref off, clicking a pattern replaces the active doc (no new tab)', () => {
    s().setOpenDocsInNewTab(false);
    s().setTitle('My work');
    act(() => {
      s().openPatternLibrary();
    });
    render(<PatternLibraryDialog />);

    const pattern = firstPattern();
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: `Load pattern: ${pattern.label}` }));
    });

    expect(s().tabOrder).toHaveLength(1);
    expect(s().doc.title).not.toBe('My work');
  });
});
