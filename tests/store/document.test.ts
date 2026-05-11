import { flushPersist } from '@/services/persistDebounced';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { beforeEach, describe, expect, it } from 'vitest';

beforeEach(resetStoreForTest);

const addNode = (title = 'Node') =>
  useDocumentStore.getState().addEntity({ type: 'effect', title });

const connect = (sourceId: string, targetId: string) =>
  useDocumentStore.getState().connect(sourceId, targetId);

describe('groupAsAnd', () => {
  it('rejects with fewer than two edges', () => {
    const a = addNode('A');
    const b = addNode('B');
    const e = connect(a.id, b.id);
    if (!e) throw new Error('edge not created');
    const result = useDocumentStore.getState().groupAsAnd([e.id]);
    expect(result.ok).toBe(false);
  });

  it('rejects when edges do not share a target', () => {
    const a = addNode('A');
    const b = addNode('B');
    const c = addNode('C');
    const d = addNode('D');
    const e1 = connect(a.id, b.id);
    const e2 = connect(c.id, d.id);
    if (!e1 || !e2) throw new Error('edges not created');
    const result = useDocumentStore.getState().groupAsAnd([e1.id, e2.id]);
    expect(result.ok).toBe(false);
  });

  it('groups edges sharing a target and assigns a stable id', () => {
    const a = addNode('Cause A');
    const b = addNode('Cause B');
    const target = addNode('Effect');
    const e1 = connect(a.id, target.id);
    const e2 = connect(b.id, target.id);
    if (!e1 || !e2) throw new Error('edges not created');
    const result = useDocumentStore.getState().groupAsAnd([e1.id, e2.id]);
    expect(result.ok).toBe(true);
    const groupId = result.ok ? result.groupId : '';
    const doc = useDocumentStore.getState().doc;
    expect(doc.edges[e1.id]!.andGroupId).toBe(groupId);
    expect(doc.edges[e2.id]!.andGroupId).toBe(groupId);
  });

  it('reuses an existing group id when extending a group', () => {
    const a = addNode('A');
    const b = addNode('B');
    const c = addNode('C');
    const target = addNode('Effect');
    const e1 = connect(a.id, target.id);
    const e2 = connect(b.id, target.id);
    const e3 = connect(c.id, target.id);
    if (!e1 || !e2 || !e3) throw new Error('edges not created');
    const first = useDocumentStore.getState().groupAsAnd([e1.id, e2.id]);
    expect(first.ok).toBe(true);
    const groupId = first.ok ? first.groupId : '';
    const second = useDocumentStore.getState().groupAsAnd([e2.id, e3.id]);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.groupId).toBe(groupId);
    const doc = useDocumentStore.getState().doc;
    expect(doc.edges[e3.id]!.andGroupId).toBe(groupId);
  });
});

describe('ungroupAnd', () => {
  it('clears andGroupId on the given edges', () => {
    const a = addNode('A');
    const b = addNode('B');
    const target = addNode('Effect');
    const e1 = connect(a.id, target.id);
    const e2 = connect(b.id, target.id);
    if (!e1 || !e2) throw new Error('edges not created');
    useDocumentStore.getState().groupAsAnd([e1.id, e2.id]);
    useDocumentStore.getState().ungroupAnd([e1.id, e2.id]);
    const doc = useDocumentStore.getState().doc;
    expect(doc.edges[e1.id]!.andGroupId).toBeUndefined();
    expect(doc.edges[e2.id]!.andGroupId).toBeUndefined();
  });

  it('is a no-op for edges that have no group', () => {
    const a = addNode('A');
    const b = addNode('B');
    const e = connect(a.id, b.id);
    if (!e) throw new Error('edge not created');
    const before = useDocumentStore.getState().doc;
    useDocumentStore.getState().ungroupAnd([e.id]);
    const after = useDocumentStore.getState().doc;
    expect(after).toBe(before);
  });
});

describe('undo / redo', () => {
  it('reverses an add and re-applies on redo', () => {
    const e = addNode('Hello');
    expect(useDocumentStore.getState().doc.entities[e.id]).toBeDefined();
    useDocumentStore.getState().undo();
    expect(useDocumentStore.getState().doc.entities[e.id]).toBeUndefined();
    useDocumentStore.getState().redo();
    expect(useDocumentStore.getState().doc.entities[e.id]).toBeDefined();
  });

  it('clears the future stack when a new mutation lands after undo', () => {
    addNode('A');
    useDocumentStore.getState().undo();
    expect(useDocumentStore.getState().future.length).toBe(1);
    addNode('B');
    expect(useDocumentStore.getState().future.length).toBe(0);
  });

  it('coalesces same-field updates inside the 1s window into one history entry', () => {
    const e = addNode('Initial');
    const pastBefore = useDocumentStore.getState().past.length;
    const { updateEntity } = useDocumentStore.getState();
    updateEntity(e.id, { title: 'a' });
    updateEntity(e.id, { title: 'ab' });
    updateEntity(e.id, { title: 'abc' });
    const pastAfter = useDocumentStore.getState().past.length;
    // Three updates with identical coalesce key, all within 1s of each other,
    // should add exactly one history entry.
    expect(pastAfter - pastBefore).toBe(1);
    // One undo restores the pre-typing title.
    useDocumentStore.getState().undo();
    expect(useDocumentStore.getState().doc.entities[e.id]!.title).toBe('Initial');
  });

  it('does not coalesce updates to different fields', () => {
    const e = addNode('Initial');
    const pastBefore = useDocumentStore.getState().past.length;
    const { updateEntity } = useDocumentStore.getState();
    updateEntity(e.id, { title: 'New' });
    updateEntity(e.id, { description: 'desc' });
    expect(useDocumentStore.getState().past.length - pastBefore).toBe(2);
  });

  it('respects the 100-entry limit', () => {
    for (let i = 0; i < 150; i++) addNode(`N${i}`);
    expect(useDocumentStore.getState().past.length).toBeLessThanOrEqual(100);
  });
});

describe('persistence side-effect', () => {
  it('writes to localStorage after flushing the debounce queue', () => {
    addNode('Persisted');
    flushPersist();
    const raw = localStorage.getItem('tp-studio:active-document:v1');
    expect(raw).not.toBeNull();
  });
});

describe('assumptions on edges', () => {
  it('addAssumptionToEdge creates an assumption entity and attaches it', () => {
    const a = addNode('Cause');
    const b = addNode('Effect');
    const e = connect(a.id, b.id);
    if (!e) throw new Error('edge not created');
    const assumption = useDocumentStore.getState().addAssumptionToEdge(e.id);
    expect(assumption).not.toBeNull();
    if (!assumption) return;
    const doc = useDocumentStore.getState().doc;
    expect(doc.entities[assumption.id]!.type).toBe('assumption');
    expect(doc.edges[e.id]!.assumptionIds).toEqual([assumption.id]);
  });

  it('addAssumptionToEdge returns null for an unknown edge', () => {
    const result = useDocumentStore.getState().addAssumptionToEdge('does-not-exist');
    expect(result).toBeNull();
  });

  it('attachAssumption is idempotent', () => {
    const a = addNode('Cause');
    const b = addNode('Effect');
    const e = connect(a.id, b.id);
    if (!e) throw new Error('edge not created');
    const assumption = useDocumentStore.getState().addAssumptionToEdge(e.id);
    if (!assumption) throw new Error('assumption not created');
    useDocumentStore.getState().attachAssumption(e.id, assumption.id);
    useDocumentStore.getState().attachAssumption(e.id, assumption.id);
    const ids = useDocumentStore.getState().doc.edges[e.id]!.assumptionIds;
    expect(ids).toEqual([assumption.id]);
  });

  it('detachAssumption removes the id and clears the field when empty', () => {
    const a = addNode('Cause');
    const b = addNode('Effect');
    const e = connect(a.id, b.id);
    if (!e) throw new Error('edge not created');
    const assumption = useDocumentStore.getState().addAssumptionToEdge(e.id);
    if (!assumption) throw new Error('assumption not created');
    useDocumentStore.getState().detachAssumption(e.id, assumption.id);
    const edge = useDocumentStore.getState().doc.edges[e.id];
    expect(edge!.assumptionIds).toBeUndefined();
    // entity itself still exists
    expect(useDocumentStore.getState().doc.entities[assumption.id]).toBeDefined();
  });

  it('deleting an assumption entity scrubs its id from every edge', () => {
    const a = addNode('Cause');
    const b = addNode('Effect');
    const c = addNode('Other Cause');
    const d = addNode('Other Effect');
    const e1 = connect(a.id, b.id);
    const e2 = connect(c.id, d.id);
    if (!e1 || !e2) throw new Error('edges not created');
    const assumption = useDocumentStore.getState().addAssumptionToEdge(e1.id);
    if (!assumption) throw new Error('assumption not created');
    useDocumentStore.getState().attachAssumption(e2.id, assumption.id);
    // sanity
    expect(useDocumentStore.getState().doc.edges[e1.id]!.assumptionIds).toContain(assumption.id);
    expect(useDocumentStore.getState().doc.edges[e2.id]!.assumptionIds).toContain(assumption.id);

    useDocumentStore.getState().deleteEntity(assumption.id);

    const doc = useDocumentStore.getState().doc;
    expect(doc.entities[assumption.id]).toBeUndefined();
    expect(doc.edges[e1.id]!.assumptionIds).toBeUndefined();
    expect(doc.edges[e2.id]!.assumptionIds).toBeUndefined();
  });
});
