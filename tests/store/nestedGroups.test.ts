import { resetStoreForTest, useDocumentStore } from '@/store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seedEntity } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);
afterEach(resetStoreForTest);

const doc = () => useDocumentStore.getState().doc;

describe('FL-GR2 — nested groups', () => {
  it('createGroupFromSelection accepts group IDs as members (nesting)', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const s = useDocumentStore.getState();
    const inner = s.createGroupFromSelection([a.id, b.id], { title: 'Inner' });
    expect(inner).not.toBeNull();
    if (!inner) return;
    const c = seedEntity('C');
    const outer = s.createGroupFromSelection([inner.id, c.id], { title: 'Outer' });
    expect(outer).not.toBeNull();
    if (!outer) return;
    // The outer group lists the inner group's id among its members.
    expect(doc().groups[outer.id]?.memberIds).toContain(inner.id);
    expect(doc().groups[outer.id]?.memberIds).toContain(c.id);
  });

  it('addToGroup can nest one group inside another', () => {
    const s = useDocumentStore.getState();
    const child = s.createGroupFromSelection([seedEntity('A').id], { title: 'Child' });
    const parent = s.createGroupFromSelection([seedEntity('B').id], { title: 'Parent' });
    expect(child).not.toBeNull();
    expect(parent).not.toBeNull();
    if (!child || !parent) return;
    s.addToGroup(parent.id, child.id);
    expect(doc().groups[parent.id]?.memberIds).toContain(child.id);
  });

  it('addToGroup refuses to create cycles (child group cannot contain its parent)', () => {
    const s = useDocumentStore.getState();
    const child = s.createGroupFromSelection([seedEntity('A').id], { title: 'Child' });
    const parent = s.createGroupFromSelection([seedEntity('B').id], { title: 'Parent' });
    if (!child || !parent) return;
    s.addToGroup(parent.id, child.id);
    // Now try to nest parent inside child — would create a cycle.
    s.addToGroup(child.id, parent.id);
    expect(doc().groups[child.id]?.memberIds.includes(parent.id)).toBe(false);
  });

  it('deleteGroup promotes nested children up one level (FL-GR5 verification)', () => {
    const s = useDocumentStore.getState();
    const a = seedEntity('A');
    const b = seedEntity('B');
    const inner = s.createGroupFromSelection([a.id, b.id], { title: 'Inner' });
    const c = seedEntity('C');
    if (!inner) return;
    const outer = s.createGroupFromSelection([inner.id, c.id], { title: 'Outer' });
    if (!outer) return;
    // Delete the inner group — its members should land in the outer group.
    s.deleteGroup(inner.id);
    const outerNow = doc().groups[outer.id];
    expect(outerNow?.memberIds).toContain(a.id);
    expect(outerNow?.memberIds).toContain(b.id);
    expect(outerNow?.memberIds).toContain(c.id);
    expect(outerNow?.memberIds.includes(inner.id)).toBe(false);
  });
});
