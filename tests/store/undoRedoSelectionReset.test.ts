import { beforeEach, describe, expect, it } from 'vitest';
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
