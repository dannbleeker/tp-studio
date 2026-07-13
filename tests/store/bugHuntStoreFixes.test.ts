import { beforeEach, describe, expect, it } from 'vitest';
import { createDocument } from '@/domain/factory';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../helpers/seedDoc';

beforeEach(() => {
  resetStoreForTest();
  localStorage.clear();
});
const s = () => useDocumentStore.getState();

describe('reverseEdge on a junctor-grouped edge (bug-hunt #1)', () => {
  it('strips junctor membership and prunes the group left with one member', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const c = seedEntity('C');
    const eAC = s().connect(a.id, c.id);
    const eBC = s().connect(b.id, c.id);
    if (!eAC || !eBC) throw new Error('setup');
    s().groupAsAnd([eAC.id, eBC.id]);
    expect(s().doc.edges[eAC.id]?.andGroupId).toBeDefined();

    s().reverseEdge(eAC.id);

    // The reversed edge (now C→A) dropped its junctor membership...
    const rev = s().doc.edges[eAC.id];
    expect(rev?.sourceId).toBe(c.id);
    expect(rev?.targetId).toBe(a.id);
    expect(rev?.andGroupId).toBeUndefined();
    // ...and the lone remaining member collapsed back to a plain edge (no
    // mixed-target group survives).
    expect(s().doc.edges[eBC.id]?.andGroupId).toBeUndefined();
  });
});

describe('openTab guard against a duplicate id (bug-hunt #2)', () => {
  it('replaces the active tab in place when its own id is re-opened', () => {
    s().setTitle('Original');
    const id = s().activeDocId;
    const before = s().tabOrder.length;

    s().openTab({ ...createDocument('crt'), id, title: 'Re-imported' });

    expect(s().tabOrder.filter((t) => t === id)).toHaveLength(1); // no duplicate
    expect(s().tabOrder.length).toBe(before);
    expect(s().doc.id).toBe(id);
    expect(s().doc.title).toBe('Re-imported'); // body replaced
  });

  it('replaces a background tab in place and switches to it', () => {
    s().setTitle('D');
    const dId = s().activeDocId;
    s().openTab(createDocument('frt')); // active is now the FRT; D is a background tab
    const before = s().tabOrder.length;

    s().openTab({ ...createDocument('crt'), id: dId, title: 'D-reimported' });

    expect(s().tabOrder.filter((t) => t === dId)).toHaveLength(1);
    expect(s().tabOrder.length).toBe(before);
    expect(s().activeDocId).toBe(dId);
    expect(s().doc.title).toBe('D-reimported');
  });
});
