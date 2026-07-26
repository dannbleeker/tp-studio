import { beforeEach, describe, expect, it } from 'vitest';
import { persistTabsManifest, readTabsManifest } from '@/domain/persistence';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../helpers/seedDoc';

/**
 * B1 — undo/redo must not leave `selection` pointing at ids the restored doc
 * no longer contains. Adding an entity selects it; undoing the add removes the
 * entity, so a surviving selection would drive the toolbar / bulk actions
 * against a missing entity. We clear selection on undo + redo, matching how
 * delete + document-swap already reset it.
 */
beforeEach(resetStoreForTest);

const s = () => useDocumentStore.getState();

describe('undo/redo selection reset (B1)', () => {
  it('clears selection on undo of an add — the added id is gone', () => {
    const e = seedEntity('Doomed');
    expect(s().selection).toEqual({ kind: 'entities', ids: [e.id] });

    s().undo();

    expect(s().doc.entities[e.id]).toBeUndefined();
    expect(s().selection).toEqual({ kind: 'none' });
  });

  it('clears selection on redo too, rather than leaving a dangling reference', () => {
    const e = seedEntity('Doomed');
    s().undo();
    s().redo();

    // The entity is restored by redo…
    expect(s().doc.entities[e.id]).toBeDefined();
    // …but selection stays cleared (symmetric with undo).
    expect(s().selection).toEqual({ kind: 'none' });
  });
});

/**
 * Session 209 — undo/redo across a document SWAP also rekeys the active tab,
 * and nothing wrote that to the tab manifest. In memory the undo was correct;
 * on reload the manifest still named the doc the undo had just undone, so boot
 * reopened it and the user's tree was reachable only via Start → All trees.
 *
 * `performDocumentSwap` got this fix in Session 206; the history slice performs
 * the same rekey and needed it too.
 */
describe('undo/redo across a document swap rewrites the tab manifest', () => {
  it('undoing a New diagram points the manifest back at the original doc', () => {
    const originalId = s().activeDocId;
    seedEntity('Real work');
    s().newDocument('frt');
    const newId = s().activeDocId;
    expect(readTabsManifest()?.activeDocId).toBe(newId);

    s().undo();

    expect(s().activeDocId).toBe(originalId);
    expect(readTabsManifest()?.activeDocId).toBe(originalId);
    expect(readTabsManifest()?.tabOrder).toContain(originalId);
  });

  it('redoing the swap points the manifest forward again', () => {
    seedEntity('Real work');
    s().newDocument('frt');
    const newId = s().activeDocId;
    s().undo();
    s().redo();

    expect(s().activeDocId).toBe(newId);
    expect(readTabsManifest()?.activeDocId).toBe(newId);
  });

  it('leaves the manifest alone for an ordinary same-doc undo', () => {
    const id = s().activeDocId;
    persistTabsManifest({ activeDocId: id, tabOrder: [id, 'a-background-tab' as never] });
    seedEntity('Edit');
    s().undo();

    expect(readTabsManifest()?.tabOrder).toEqual([id, 'a-background-tab']);
  });
});
