import { beforeEach, describe, expect, it } from 'vitest';
import {
  __clearClipboardForTest,
  copySelection,
  cutSelection,
  pasteClipboard,
} from '@/services/clipboard';
import { resetStoreForTest, useDocumentStore } from '@/store';
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

  it('paste preserves the edge kind + all metadata, not just the endpoints', () => {
    const a = addNode('A');
    const b = addNode('B');
    const edge = connect(a.id, b.id);
    expect(edge).toBeTruthy();
    if (!edge) return;
    const store = useDocumentStore.getState();
    // A full spread of edge metadata + a flip to necessity (the kind createEdge
    // would otherwise hard-code back to 'sufficiency' on paste).
    store.updateEdge(edge.id, {
      kind: 'necessity',
      label: 'Important',
      description: 'why this holds',
      isBackEdge: true,
      delay: true,
      loopName: 'Burnout spiral',
      loopNarrative: 'escalates over months',
    });
    store.setEdgeWeight(edge.id, 'negative');
    store.selectEntities([a.id, b.id]);

    copySelection();
    pasteClipboard();

    const doc = useDocumentStore.getState().doc;
    const pasted = Object.values(doc.edges).find((e) => e.id !== edge.id);
    expect(pasted).toBeTruthy();
    if (!pasted) return;
    expect(pasted.kind).toBe('necessity');
    expect(pasted.weight).toBe('negative');
    expect(pasted.label).toBe('Important');
    expect(pasted.description).toBe('why this holds');
    expect(pasted.isBackEdge).toBe(true);
    expect(pasted.delay).toBe(true);
    expect(pasted.loopName).toBe('Burnout spiral');
    expect(pasted.loopNarrative).toBe('escalates over months');
  });

  it('paste drops junctor group ids (they reference a cross-edge group)', () => {
    // Two edges into a shared target, AND-grouped. Copy ALL three nodes so both
    // edges are interior; the pasted copies must NOT carry the original groupId
    // (which would alias/dangle the source group).
    const a = addNode('A');
    const b = addNode('B');
    const c = addNode('C');
    const e1 = connect(a.id, c.id);
    const e2 = connect(b.id, c.id);
    expect(e1 && e2).toBeTruthy();
    if (!e1 || !e2) return;
    const store = useDocumentStore.getState();
    const grouped = store.groupAsAnd([e1.id, e2.id]);
    expect(grouped.ok).toBe(true);
    store.selectEntities([a.id, b.id, c.id]);

    copySelection();
    pasteClipboard();

    const doc = useDocumentStore.getState().doc;
    const pasted = Object.values(doc.edges).filter((e) => e.id !== e1.id && e.id !== e2.id);
    expect(pasted).toHaveLength(2);
    for (const e of pasted) {
      expect(e.andGroupId).toBeUndefined();
      expect(e.orGroupId).toBeUndefined();
      expect(e.xorGroupId).toBeUndefined();
    }
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
