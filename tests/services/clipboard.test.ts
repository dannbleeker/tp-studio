import { beforeEach, describe, expect, it } from 'vitest';
import type { Group, GroupId } from '@/domain/types';
import {
  __clearClipboardForTest,
  copySelection,
  cutSelection,
  duplicateSelection,
  mergeDocIntoActive,
  pasteClipboard,
} from '@/services/clipboard';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { makeDoc, makeEdge, makeEntity, resetIds } from '../domain/helpers';
import { seedEntity } from '../helpers/seedDoc';

// Thin aliases over the shared seedDoc helpers — the tests below read
// better with `addNode('A')` than the full helper names.
const addNode = (title = 'N') => seedEntity(title);
const connect = (s: string, t: string) => useDocumentStore.getState().connect(s, t);

beforeEach(() => {
  resetStoreForTest();
  __clearClipboardForTest();
  resetIds();
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

  it('paste carries entity content (position, attributes, span-of-control), re-minting identity', () => {
    const a = addNode('A');
    const store = useDocumentStore.getState();
    store.updateEntity(a.id, {
      position: { x: 137, y: 248 },
      spanOfControl: 'external',
      description: 'a note',
    });
    store.setEntityAttribute(a.id, 'custom', { kind: 'string', value: 'kept' });
    store.selectEntity(a.id);
    copySelection();
    pasteClipboard();

    const doc = useDocumentStore.getState().doc;
    const pasted = Object.values(doc.entities).find((e) => e.id !== a.id);
    expect(pasted).toBeTruthy();
    if (!pasted) return;
    // First paste offsets one diagonal step (32px) so the copy isn't hidden
    // exactly behind the source.
    expect(pasted.position).toEqual({ x: 137 + 32, y: 248 + 32 });
    expect(pasted.spanOfControl).toBe('external');
    expect(pasted.description).toBe('a note');
    expect(pasted.attributes?.custom).toEqual({ kind: 'string', value: 'kept' });
    // Identity is freshly minted, not copied.
    expect(pasted.id).not.toBe(a.id);
    expect(pasted.annotationNumber).not.toBe(doc.entities[a.id]?.annotationNumber);
  });

  it('paste drops entity binding fields (ecSlot, coreProblem) that must not duplicate', () => {
    const a = addNode('A');
    const store = useDocumentStore.getState();
    store.updateEntity(a.id, { ecSlot: 'a', coreProblem: true });
    store.selectEntity(a.id);
    copySelection();
    pasteClipboard();

    const doc = useDocumentStore.getState().doc;
    const pasted = Object.values(doc.entities).find((e) => e.id !== a.id);
    expect(pasted).toBeTruthy();
    if (!pasted) return;
    expect(pasted.ecSlot).toBeUndefined();
    expect(pasted.coreProblem).toBeUndefined();
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

  it('repeated pastes fan out — each copy offsets one step further', () => {
    const a = addNode('A');
    const store = useDocumentStore.getState();
    store.updateEntity(a.id, { position: { x: 0, y: 0 } });
    store.selectEntity(a.id);
    copySelection();

    pasteClipboard(); // cascade 1 → +32
    const first = Object.values(useDocumentStore.getState().doc.entities).find(
      (e) => e.id !== a.id
    );
    expect(first?.position).toEqual({ x: 32, y: 32 });

    pasteClipboard(); // cascade 2 → +64 (relative to the ORIGINAL source)
    const ids = new Set([a.id, first?.id]);
    const second = Object.values(useDocumentStore.getState().doc.entities).find(
      (e) => !ids.has(e.id)
    );
    expect(second?.position).toEqual({ x: 64, y: 64 });
  });

  it('a fresh copy resets the paste cascade back to the first step', () => {
    const a = addNode('A');
    const store = useDocumentStore.getState();
    store.updateEntity(a.id, { position: { x: 0, y: 0 } });
    store.selectEntity(a.id);
    copySelection();
    pasteClipboard(); // cascade 1
    pasteClipboard(); // cascade 2

    // Re-copy the original → cascade resets, so the next paste is +32 again.
    store.selectEntity(a.id);
    copySelection();
    pasteClipboard();
    const fresh = Object.values(useDocumentStore.getState().doc.entities)
      .filter((e) => e.position?.x === 32 && e.position?.y === 32)
      .find((e) => e.id !== a.id);
    expect(fresh).toBeTruthy();
  });

  it('duplicateSelection clones the selection without touching the clipboard buffer', () => {
    const a = addNode('A');
    const b = addNode('B');
    const store = useDocumentStore.getState();
    store.selectEntity(a.id);
    copySelection(); // buffer now holds A only

    // Duplicate a DIFFERENT selection — must clone B, and must NOT overwrite
    // the A that's sitting on the clipboard.
    store.selectEntity(b.id);
    const r = duplicateSelection();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entities).toBe(1);

    // The clipboard still holds A: pasting produces an A copy, not a B copy.
    const paste = pasteClipboard();
    expect(paste.ok).toBe(true);
    const titles = Object.values(useDocumentStore.getState().doc.entities).map((e) => e.title);
    // A (orig) + B (orig) + B (dup) + A (paste)
    expect(titles.filter((t) => t === 'A')).toHaveLength(2);
    expect(titles.filter((t) => t === 'B')).toHaveLength(2);
  });

  it('duplicateSelection is a no-op when nothing is selected', () => {
    expect(duplicateSelection().ok).toBe(false);
  });
});

describe('mergeDocIntoActive (Session 193 — insert a template into the current doc)', () => {
  const makeSource = () => {
    // SA & SB AND-join into SC; SA + SB sit in one group.
    const sa = makeEntity({ title: 'SA' });
    const sb = makeEntity({ title: 'SB' });
    const sc = makeEntity({ title: 'SC' });
    const e1 = makeEdge(sa.id, sc.id, { andGroupId: 'g-src' });
    const e2 = makeEdge(sb.id, sc.id, { andGroupId: 'g-src' });
    const source = makeDoc([sa, sb, sc], [e1, e2]);
    const grp: Group = {
      id: 'grp1' as GroupId,
      title: 'Cluster',
      color: 'indigo',
      memberIds: [sa.id, sb.id],
      collapsed: false,
      createdAt: 1,
      updatedAt: 1,
    };
    source.groups = { [grp.id]: grp };
    return { source, sa, sb, sc };
  };

  it('splices a full subgraph with fresh ids, remapped junctor + groups, and selects it', () => {
    const { source, sa } = makeSource();
    const existing = seedEntity('Existing'); // annotation #1
    const res = mergeDocIntoActive(source);
    expect(res).toEqual({ entities: 3, edges: 2 });

    const doc = useDocumentStore.getState().doc;
    // 1 existing + 3 inserted, and the source ids were re-minted (no collision).
    expect(Object.keys(doc.entities)).toHaveLength(4);
    expect(doc.entities[existing.id]).toBeTruthy();
    expect(doc.entities[sa.id]).toBeUndefined();

    // The two inserted edges still share ONE junctor — a FRESH id, not 'g-src'.
    const gids = new Set(Object.values(doc.edges).map((e) => e.andGroupId));
    expect(gids.size).toBe(1);
    const [gid] = [...gids];
    expect(gid).toBeTruthy();
    expect(gid).not.toBe('g-src');

    // The group came across with a fresh id + remapped members.
    const groups = Object.values(doc.groups);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.title).toBe('Cluster');
    expect(groups[0]?.memberIds).toHaveLength(2);
    expect(groups[0]?.memberIds).not.toContain(sa.id);

    // Annotation numbers continued past the existing #1.
    expect(doc.nextAnnotationNumber).toBe(5);

    // The inserted entities are selected for immediate operation.
    const sel = useDocumentStore.getState().selection;
    expect(sel.kind).toBe('entities');
    if (sel.kind === 'entities') expect(sel.ids).toHaveLength(3);
  });

  it('lands as one history step (Ctrl+Z removes the whole insert)', () => {
    const { source } = makeSource();
    seedEntity('Existing');
    mergeDocIntoActive(source);
    expect(Object.keys(useDocumentStore.getState().doc.entities)).toHaveLength(4);
    useDocumentStore.getState().undo();
    expect(Object.keys(useDocumentStore.getState().doc.entities)).toHaveLength(1);
  });
});
