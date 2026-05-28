/**
 * Session 137 / multi-doc tabs Batch 1 — see
 * `docs/MULTI_DOC_TABS_PLAN.md`.
 *
 * Tests the `currentDoc(state)` selector. Today it's a thin alias for
 * `state.doc`; the test pins that contract so a future Phase-2 swap of
 * the data model can be verified to preserve the alias semantics.
 *
 * The `seedTab` helper smoke-test at the bottom also exercises the
 * new test fixture so knip doesn't flag it as dead code.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';
import { seedTab } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);

describe('currentDoc selector', () => {
  it('returns the same reference as state.doc on a fresh store', () => {
    const state = useDocumentStore.getState();
    expect(currentDoc(state)).toBe(state.doc);
  });

  it('tracks the document across newDocument swaps', () => {
    const before = currentDoc(useDocumentStore.getState());
    useDocumentStore.getState().newDocument('frt');
    const after = currentDoc(useDocumentStore.getState());
    expect(after).not.toBe(before);
    expect(after.diagramType).toBe('frt');
    // Alias contract: currentDoc returns whatever state.doc points at.
    expect(after).toBe(useDocumentStore.getState().doc);
  });

  it('tracks the document across mutations', () => {
    const before = currentDoc(useDocumentStore.getState());
    useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
    const after = currentDoc(useDocumentStore.getState());
    expect(after).not.toBe(before);
    expect(Object.keys(after.entities).length).toBe(1);
    expect(after).toBe(useDocumentStore.getState().doc);
  });
});

describe('seedTab helper (multi-doc Batch 1)', () => {
  it('opens a fresh document and returns its id', () => {
    const id = seedTab('crt');
    expect(id).toBeTruthy();
    expect(useDocumentStore.getState().doc.id).toBe(id);
    expect(useDocumentStore.getState().doc.diagramType).toBe('crt');
  });

  it('defaults to CRT when no diagram type is passed', () => {
    seedTab();
    expect(useDocumentStore.getState().doc.diagramType).toBe('crt');
  });

  it('honors the diagram type argument', () => {
    seedTab('frt');
    expect(useDocumentStore.getState().doc.diagramType).toBe('frt');
  });
});
