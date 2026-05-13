import {
  __clearClipboardForTest,
  copySelection,
  cutSelection,
  pasteClipboard,
} from '@/services/clipboard';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { beforeEach, describe, expect, it } from 'vitest';
import { seedEntity } from '../helpers/seedDoc';

// Thin aliases over the shared seedDoc helpers — the tests below read
// better with `addNode('A')` than the full helper names.
const addNode = (title = 'N') => seedEntity(title);
const connect = (s: string, t: string) => useDocumentStore.getState().connect(s, t);

beforeEach(() => {
  resetStoreForTest();
  __clearClipboardForTest();
});

describe('clipboard', () => {
  it('copy returns 0 when no entities are selected', () => {
    expect(copySelection()).toBe(0);
  });

  it('copy/paste mints new entities + remaps interior edges', () => {
    const a = addNode('A');
    const b = addNode('B');
    const c = addNode('C');
    connect(a.id, b.id);
    connect(b.id, c.id);
    useDocumentStore.getState().selectEntities([a.id, b.id, c.id]);

    expect(copySelection()).toBe(3);
    const r = pasteClipboard();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entities).toBe(3);
    expect(r.edges).toBe(2);

    const doc = useDocumentStore.getState().doc;
    expect(Object.keys(doc.entities)).toHaveLength(6);
    expect(Object.keys(doc.edges)).toHaveLength(4);
  });

  it('paste twice produces two independent copies', () => {
    const a = addNode('A');
    const b = addNode('B');
    connect(a.id, b.id);
    useDocumentStore.getState().selectEntities([a.id, b.id]);
    copySelection();
    pasteClipboard();
    pasteClipboard();
    const entities = Object.keys(useDocumentStore.getState().doc.entities);
    expect(entities).toHaveLength(6);
  });

  it('cut copies then deletes the selection', () => {
    const a = addNode('A');
    const b = addNode('B');
    useDocumentStore.getState().selectEntities([a.id, b.id]);
    expect(cutSelection()).toBe(2);
    const doc = useDocumentStore.getState().doc;
    expect(doc.entities[a.id]).toBeUndefined();
    expect(doc.entities[b.id]).toBeUndefined();
    const r = pasteClipboard();
    expect(r.ok).toBe(true);
  });

  it('paste assigns fresh annotation numbers in sequence', () => {
    const a = addNode('A'); // annotation 1
    const b = addNode('B'); // annotation 2
    useDocumentStore.getState().selectEntities([a.id, b.id]);
    copySelection();
    const before = useDocumentStore.getState().doc.nextAnnotationNumber;
    pasteClipboard();
    const after = useDocumentStore.getState().doc.nextAnnotationNumber;
    expect(after).toBe(before + 2);
  });

  it('paste selects the newly pasted entities', () => {
    const a = addNode('A');
    useDocumentStore.getState().selectEntity(a.id);
    copySelection();
    pasteClipboard();
    const sel = useDocumentStore.getState().selection;
    expect(sel.kind).toBe('entities');
    if (sel.kind === 'entities') expect(sel.ids).toHaveLength(1);
  });
});
