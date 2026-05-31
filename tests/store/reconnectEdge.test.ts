import { beforeEach, describe, expect, it } from 'vitest';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);

const store = () => useDocumentStore.getState();
const node = (title: string) => seedEntity(title);
const connect = (s: string, t: string) => {
  const e = store().connect(s, t);
  if (!e) throw new Error('edge not created');
  return e;
};
const edgeOf = (id: string) => {
  const e = store().doc.edges[id];
  if (!e) throw new Error('edge missing');
  return e;
};

/**
 * `reconnectEdge` — re-target an existing connector by dragging one endpoint
 * onto a different entity (React Flow reconnection). Mirrors `connect`'s guards
 * and `reverseEdge`'s undoable endpoint mutation.
 */
describe('reconnectEdge — re-target an existing connector', () => {
  it('changes the target endpoint', () => {
    const a = node('A');
    const b = node('B');
    const c = node('C');
    const e = connect(a.id, b.id);
    expect(store().reconnectEdge(e.id, a.id, c.id)).not.toBeNull();
    expect(edgeOf(e.id).sourceId).toBe(a.id);
    expect(edgeOf(e.id).targetId).toBe(c.id);
  });

  it('changes the source endpoint', () => {
    const a = node('A');
    const b = node('B');
    const c = node('C');
    const e = connect(a.id, b.id);
    store().reconnectEdge(e.id, c.id, b.id);
    expect(edgeOf(e.id).sourceId).toBe(c.id);
    expect(edgeOf(e.id).targetId).toBe(b.id);
  });

  it('rejects a self-loop and leaves the edge unchanged', () => {
    const a = node('A');
    const b = node('B');
    const e = connect(a.id, b.id);
    expect(store().reconnectEdge(e.id, a.id, a.id)).toBeNull();
    expect(edgeOf(e.id).targetId).toBe(b.id);
  });

  it('rejects a move that would duplicate an existing edge', () => {
    const a = node('A');
    const b = node('B');
    const c = node('C');
    const e1 = connect(a.id, b.id);
    connect(a.id, c.id); // an A→C edge already exists
    expect(store().reconnectEdge(e1.id, a.id, c.id)).toBeNull();
    expect(edgeOf(e1.id).targetId).toBe(b.id);
  });

  it('is a no-op (no history entry) when neither endpoint changes', () => {
    const a = node('A');
    const b = node('B');
    const e = connect(a.id, b.id);
    const before = store().doc;
    expect(store().reconnectEdge(e.id, a.id, b.id)).toBeNull();
    expect(store().doc).toBe(before);
  });

  it('returns null for an unknown edge or a missing endpoint entity', () => {
    const a = node('A');
    const b = node('B');
    const e = connect(a.id, b.id);
    expect(store().reconnectEdge('nope', a.id, b.id)).toBeNull();
    expect(store().reconnectEdge(e.id, a.id, 'ghost')).toBeNull();
  });

  it('drops junctor membership when the target moves, keeps it when only the source moves', () => {
    const a = node('A');
    const b = node('B');
    const c = node('C');
    const d = node('D');
    const e1 = connect(a.id, c.id);
    const e2 = connect(b.id, c.id);
    const grp = store().groupAsAnd([e1.id, e2.id]);
    if (!grp.ok) throw new Error('grouping failed');
    expect(edgeOf(e1.id).andGroupId).toBe(grp.groupId);

    // Move e1's TARGET (c → d): it leaves that convergence.
    store().reconnectEdge(e1.id, a.id, d.id);
    expect(edgeOf(e1.id).andGroupId).toBeUndefined();

    // Move e2's SOURCE (b → d), target stays c: membership preserved.
    store().reconnectEdge(e2.id, d.id, c.id);
    expect(edgeOf(e2.id).andGroupId).toBe(grp.groupId);
  });

  it('is undoable', () => {
    const a = node('A');
    const b = node('B');
    const c = node('C');
    const e = connect(a.id, b.id);
    store().reconnectEdge(e.id, a.id, c.id);
    expect(edgeOf(e.id).targetId).toBe(c.id);
    store().undo();
    expect(edgeOf(e.id).targetId).toBe(b.id);
  });
});
