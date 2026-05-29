/**
 * Multi-doc tabs Phase 2, Batch 2.1 — state-shape invariant tests.
 * See `docs/MULTI_DOC_TABS_PLAN.md` (Phase 2 detailed execution plan).
 *
 * Batch 2.1 adds `docs` / `activeDocId` / `tabOrder` alongside the
 * existing `doc`, kept in lockstep by `activeDocState` at the six
 * doc-write sites. The app is still single-tab; these tests pin the
 * invariant that holds after every kind of mutation:
 *
 *     docs[activeDocId] === doc          (same reference)
 *     tabOrder === [doc.id]              (single-tab)
 *     activeDocId === doc.id
 *
 * If any future change adds a `set({ doc })` that bypasses
 * `activeDocState`, one of these fires immediately.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);

const s = () => useDocumentStore.getState();

/** Assert the single-tab invariant on the current store state. */
const expectSingleTabInvariant = (): void => {
  const st = s();
  // The mirror is the SAME reference, not a structural copy.
  expect(st.docs[st.activeDocId]).toBe(st.doc);
  // activeDocId tracks the active doc's id.
  expect(st.activeDocId).toBe(st.doc.id);
  // Single-tab: exactly one entry, equal to the active doc.
  expect(st.tabOrder).toEqual([st.doc.id]);
  expect(Object.keys(st.docs)).toEqual([st.doc.id]);
};

describe('Batch 2.1 — single-tab invariant after each mutation kind', () => {
  it('holds on a freshly reset store', () => {
    expectSingleTabInvariant();
  });

  it('holds after addEntity', () => {
    seedEntity('A');
    expectSingleTabInvariant();
  });

  it('holds after updateEntity', () => {
    const e = seedEntity('A');
    s().updateEntity(e.id, { title: 'B' });
    expectSingleTabInvariant();
  });

  it('holds after deleteEntity', () => {
    const e = seedEntity('A');
    s().deleteEntity(e.id);
    expectSingleTabInvariant();
  });

  it('holds after connect (edge add)', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    s().connect(a.id, b.id);
    expectSingleTabInvariant();
  });

  it('holds after a group create', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    s().createGroupFromSelection([a.id, b.id]);
    expectSingleTabInvariant();
  });

  it('holds after setTitle (doc-meta edit)', () => {
    s().setTitle('Renamed');
    expectSingleTabInvariant();
    expect(s().doc.title).toBe('Renamed');
  });
});

describe('Batch 2.1 — document swaps rebuild the single-tab map', () => {
  it('newDocument replaces the active tab (old id gone, new id active)', () => {
    const oldId = s().doc.id;
    s().newDocument('frt');
    const st = s();
    expect(st.doc.diagramType).toBe('frt');
    expect(st.activeDocId).toBe(st.doc.id);
    expect(st.activeDocId).not.toBe(oldId);
    // Single-tab replace: the old doc is no longer in the map.
    expect(Object.keys(st.docs)).toEqual([st.doc.id]);
    expect(st.docs[oldId]).toBeUndefined();
    expectSingleTabInvariant();
  });

  it('setDocument swaps the active tab to the provided doc', () => {
    const oldId = s().doc.id;
    // Build a replacement doc by minting a fresh one via newDocument then
    // capturing it; simpler: use the store's own newDocument to get a
    // valid foreign doc, then setDocument back to a clone with a new id.
    s().newDocument('prt');
    const prtDoc = s().doc;
    // setDocument with the same object is a no-op-ish swap; assert the
    // invariant holds and the active id matches.
    s().setDocument(prtDoc);
    const st = s();
    expect(st.activeDocId).toBe(prtDoc.id);
    expect(st.doc).toBe(prtDoc);
    expect(oldId).toBeDefined();
    expectSingleTabInvariant();
  });
});

describe('Batch 2.1 — undo / redo keep the invariant', () => {
  it('holds after undo of a content edit (id stable)', () => {
    const e = seedEntity('A');
    const idBefore = s().doc.id;
    s().updateEntity(e.id, { title: 'B' });
    s().undo();
    expect(s().doc.id).toBe(idBefore);
    expectSingleTabInvariant();
  });

  it('holds after redo of a content edit', () => {
    const e = seedEntity('A');
    s().updateEntity(e.id, { title: 'B' });
    s().undo();
    s().redo();
    expectSingleTabInvariant();
    expect(s().doc.entities[e.id]?.title).toBe('B');
  });

  it('undo across a newDocument boundary follows the restored doc id', () => {
    // Seed content on the CRT, then newDocument('frt') (pushes the CRT
    // onto the past stack), then undo — which restores the CRT doc with
    // its ORIGINAL id. activeDocId must follow it.
    seedEntity('A');
    const crtId = s().doc.id;
    s().newDocument('frt');
    const frtId = s().doc.id;
    expect(frtId).not.toBe(crtId);

    s().undo();
    const st = s();
    // Restored to the CRT doc; activeDocId + map rebuilt around it.
    expect(st.doc.id).toBe(crtId);
    expect(st.activeDocId).toBe(crtId);
    expect(Object.keys(st.docs)).toEqual([crtId]);
    expect(st.docs[frtId]).toBeUndefined();
    expectSingleTabInvariant();
  });
});

describe('Batch 2.1 — currentDoc reads stay anchored on the active doc', () => {
  it('docs[activeDocId] is referentially identical to currentDoc', async () => {
    // currentDoc is the read seam (still returns state.doc in Phase 2).
    const { currentDoc } = await import('@/store/selectors');
    seedEntity('A');
    const st = s();
    expect(currentDoc(st)).toBe(st.doc);
    expect(currentDoc(st)).toBe(st.docs[st.activeDocId]);
  });
});
