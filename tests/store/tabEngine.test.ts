/**
 * Multi-doc tabs Phase 5, Batch 5.1 — the tab engine.
 * See `docs/MULTI_DOC_TABS_PLAN.md`.
 *
 * 5.1 flips `activeDocState` (collapse-to-one-tab) → `setActiveDoc`
 * (replace the active tab in place, leave others alone) and adds the
 * store actions `openTab` / `switchTab` / `closeTab` / `reorderTabs` /
 * `duplicateTab`. No UI yet (that's 5.2) — these tests drive the actions
 * directly. The headline guarantee is **tab isolation**: an edit on the
 * active tab must not touch any other open tab.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { createDocument } from '@/domain/factory';
import { readTabsManifest } from '@/domain/persistence';
import type { DocumentId } from '@/domain/types';
import { docCommittedKey } from '@/services/storage/keys';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../helpers/seedDoc';

beforeEach(() => {
  resetStoreForTest();
  localStorage.clear();
});

const s = () => useDocumentStore.getState();

describe('Batch 5.1 — openTab', () => {
  it('appends + activates a new tab, keeping the previous one open', () => {
    const aId = s().activeDocId;
    const b = createDocument('frt');
    s().openTab(b);
    expect(s().tabOrder).toEqual([aId, b.id]);
    expect(s().activeDocId).toBe(b.id);
    expect(s().doc.id).toBe(b.id);
    expect(s().docs[aId]).toBeDefined(); // A still open
    expect(s().docs[b.id]).toBeDefined();
  });

  it('a fresh tab starts with empty undo/redo history', () => {
    seedEntity('A1'); // give tab A some history
    expect(s().past.length).toBeGreaterThan(0);
    s().openTab(createDocument('frt'));
    expect(s().past).toEqual([]);
    expect(s().future).toEqual([]);
  });
});

describe('Batch 5.1 — tab isolation (the core multi-tab invariant)', () => {
  it('editing the active tab does not touch other open tabs', () => {
    const aId = s().activeDocId;
    const aEntity = seedEntity('OnlyOnA');
    const aSnapshot = s().docs[aId]; // capture A's doc reference

    s().openTab(createDocument('frt')); // active = B
    seedEntity('OnlyOnB'); // edits B only

    // A's doc in the map is the SAME reference — completely untouched.
    expect(s().docs[aId]).toBe(aSnapshot);
    expect(Object.values(s().docs[aId]?.entities ?? {}).some((e) => e.title === 'OnlyOnB')).toBe(
      false
    );
    expect(s().docs[aId]?.entities[aEntity.id]).toBeDefined();
  });
});

describe('Batch 5.1 — switchTab', () => {
  it('swaps the active doc; no-op for the same or an unknown id', () => {
    const aId = s().activeDocId;
    const b = createDocument('frt');
    s().openTab(b); // active = B
    s().switchTab(aId);
    expect(s().activeDocId).toBe(aId);
    expect(s().doc.id).toBe(aId);

    const before = s().doc;
    s().switchTab(aId); // already active → no-op
    expect(s().doc).toBe(before);
    s().switchTab('nonexistent' as DocumentId); // unknown → no-op
    expect(s().activeDocId).toBe(aId);
  });

  it('keeps undo/redo stacks per tab', () => {
    const aId = s().activeDocId;
    const e = seedEntity('A1');
    s().updateEntity(e.id, { title: 'A2' });
    const aPastLen = s().past.length;
    expect(aPastLen).toBeGreaterThan(0);

    const b = createDocument('frt');
    s().openTab(b);
    seedEntity('B1');
    const bPastLen = s().past.length;

    s().switchTab(aId); // back to A — A's stacks restored
    expect(s().past.length).toBe(aPastLen);
    s().undo(); // operates on A's history
    expect(s().doc.entities[e.id]?.title).toBe('A1');

    s().switchTab(b.id); // B's stacks restored, independent of A's undo
    expect(s().past.length).toBe(bPastLen);
  });

  it('clears the selection on switch', () => {
    const e = seedEntity('A1');
    s().selectEntities([e.id]);
    expect(s().selection.kind).toBe('entities');
    s().openTab(createDocument('frt'));
    expect(s().selection.kind).toBe('none');
  });
});

describe('Batch 5.1 — closeTab', () => {
  it('closing a background tab leaves the active tab untouched', () => {
    const aId = s().activeDocId;
    const b = createDocument('frt');
    s().openTab(b); // active = B
    s().closeTab(aId); // close background A
    expect(s().tabOrder).toEqual([b.id]);
    expect(s().activeDocId).toBe(b.id);
    expect(s().docs[aId]).toBeUndefined();
  });

  it('closing the active tab activates the right-hand neighbour', () => {
    const aId = s().activeDocId;
    const b = createDocument('frt');
    const c = createDocument('prt');
    s().openTab(b);
    s().openTab(c); // order [A, B, C]
    s().switchTab(b.id); // active = B (middle)
    s().closeTab(b.id);
    expect(s().activeDocId).toBe(c.id); // right neighbour
    expect(s().tabOrder).toEqual([aId, c.id]);
  });

  it('closing the last tab opens a fresh blank CRT (never zero tabs)', () => {
    const aId = s().activeDocId;
    s().closeTab(aId);
    expect(s().tabOrder.length).toBe(1);
    expect(s().activeDocId).not.toBe(aId);
    expect(s().doc.diagramType).toBe('crt');
    expect(Object.keys(s().doc.entities).length).toBe(0);
  });

  it('drops the closed doc’s per-doc storage slot', () => {
    const aId = s().activeDocId;
    const b = createDocument('frt');
    s().openTab(b); // writes b's committed slot
    expect(localStorage.getItem(docCommittedKey(b.id))).not.toBeNull();
    s().switchTab(aId); // make B a background tab
    s().closeTab(b.id);
    expect(localStorage.getItem(docCommittedKey(b.id))).toBeNull();
  });
});

describe('Batch 5.1 — reorderTabs', () => {
  it('applies a permutation and ignores a non-permutation', () => {
    const aId = s().activeDocId;
    const b = createDocument('frt');
    s().openTab(b); // [A, B]
    s().reorderTabs([b.id, aId]);
    expect(s().tabOrder).toEqual([b.id, aId]);
    s().reorderTabs([b.id]); // wrong length → ignored
    expect(s().tabOrder).toEqual([b.id, aId]);
    s().reorderTabs([b.id, 'x' as DocumentId]); // unknown id → ignored
    expect(s().tabOrder).toEqual([b.id, aId]);
  });
});

describe('Batch 5.1 — duplicateTab', () => {
  it('creates an independent copy with a (copy) title', () => {
    const aId = s().activeDocId;
    s().setTitle('Original');
    const e = seedEntity('Shared');

    s().duplicateTab(aId);
    expect(s().activeDocId).not.toBe(aId);
    expect(s().doc.title).toBe('Original (copy)');
    expect(Object.values(s().doc.entities).some((x) => x.title === 'Shared')).toBe(true);

    // Editing the copy must not touch the original.
    const copyEntity = Object.values(s().doc.entities).find((x) => x.title === 'Shared');
    expect(copyEntity).toBeDefined();
    if (copyEntity) s().updateEntity(copyEntity.id, { title: 'Changed' });
    expect(s().docs[aId]?.entities[e.id]?.title).toBe('Shared');
  });
});

describe('Batch 5.1 — manifest persistence', () => {
  it('openTab + switchTab write the manifest with the right order + active id', () => {
    const aId = s().activeDocId;
    const b = createDocument('frt');
    s().openTab(b);
    expect(readTabsManifest()).toEqual({ activeDocId: b.id, tabOrder: [aId, b.id] });
    s().switchTab(aId);
    expect(readTabsManifest()).toEqual({ activeDocId: aId, tabOrder: [aId, b.id] });
  });
});
