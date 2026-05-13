import { resetStoreForTest, useDocumentStore } from '@/store';
import { beforeEach, describe, expect, it } from 'vitest';
import { seedEntity } from '../helpers/seedDoc';

// Shorthand alias — every call site predates the move to the shared
// helper and reads better as `addNode('A')` than `seedEntity('A')`. The
// helper is the implementation; we keep the local name for readability.
const addNode = (title = 'N') => seedEntity(title);

beforeEach(resetStoreForTest);

describe('createGroupFromSelection', () => {
  it('creates a group containing the given entities and selects them', () => {
    const a = addNode('A');
    const b = addNode('B');
    const c = addNode('C');

    const g = useDocumentStore.getState().createGroupFromSelection([a.id, b.id, c.id], {
      title: 'My Group',
      color: 'emerald',
    });

    expect(g).not.toBeNull();
    if (!g) return;
    const doc = useDocumentStore.getState().doc;
    expect(doc.groups[g.id]).toBeDefined();
    expect(doc.groups[g.id]!.title).toBe('My Group');
    expect(doc.groups[g.id]!.color).toBe('emerald');
    expect(doc.groups[g.id]!.memberIds).toEqual([a.id, b.id, c.id]);
    expect(doc.groups[g.id]!.collapsed).toBe(false);
  });

  it('returns null when no valid member IDs are passed', () => {
    const r = useDocumentStore.getState().createGroupFromSelection(['nonexistent']);
    expect(r).toBeNull();
    expect(Object.keys(useDocumentStore.getState().doc.groups)).toHaveLength(0);
  });

  it('filters out unknown IDs but creates a group from the survivors', () => {
    const a = addNode('A');
    const g = useDocumentStore.getState().createGroupFromSelection([a.id, 'ghost']);
    expect(g).not.toBeNull();
    if (!g) return;
    expect(useDocumentStore.getState().doc.groups[g.id]!.memberIds).toEqual([a.id]);
  });
});

describe('renameGroup / recolorGroup / toggleGroupCollapsed', () => {
  it('updates the title and bumps updatedAt', async () => {
    const a = addNode('A');
    const g = useDocumentStore.getState().createGroupFromSelection([a.id])!;
    const before = useDocumentStore.getState().doc.groups[g.id]!.updatedAt;
    await new Promise((r) => setTimeout(r, 2));
    useDocumentStore.getState().renameGroup(g.id, 'Renamed');
    const after = useDocumentStore.getState().doc.groups[g.id]!;
    expect(after.title).toBe('Renamed');
    expect(after.updatedAt).toBeGreaterThanOrEqual(before);
  });

  it('recolors and toggles collapsed', () => {
    const a = addNode('A');
    const g = useDocumentStore.getState().createGroupFromSelection([a.id])!;
    useDocumentStore.getState().recolorGroup(g.id, 'rose');
    useDocumentStore.getState().toggleGroupCollapsed(g.id);
    const doc = useDocumentStore.getState().doc;
    expect(doc.groups[g.id]!.color).toBe('rose');
    expect(doc.groups[g.id]!.collapsed).toBe(true);
  });
});

describe('addToGroup / removeFromGroup', () => {
  it('adds and removes a member', () => {
    const a = addNode('A');
    const b = addNode('B');
    const g = useDocumentStore.getState().createGroupFromSelection([a.id])!;
    useDocumentStore.getState().addToGroup(g.id, b.id);
    expect(useDocumentStore.getState().doc.groups[g.id]!.memberIds).toEqual([a.id, b.id]);
    useDocumentStore.getState().removeFromGroup(g.id, a.id);
    expect(useDocumentStore.getState().doc.groups[g.id]!.memberIds).toEqual([b.id]);
  });

  it('ignores adding an unknown id', () => {
    const a = addNode('A');
    const g = useDocumentStore.getState().createGroupFromSelection([a.id])!;
    useDocumentStore.getState().addToGroup(g.id, 'ghost');
    expect(useDocumentStore.getState().doc.groups[g.id]!.memberIds).toEqual([a.id]);
  });
});

describe('deleteGroup', () => {
  it('removes the group but preserves member entities', () => {
    const a = addNode('A');
    const b = addNode('B');
    const g = useDocumentStore.getState().createGroupFromSelection([a.id, b.id])!;
    useDocumentStore.getState().deleteGroup(g.id);
    const doc = useDocumentStore.getState().doc;
    expect(doc.groups[g.id]).toBeUndefined();
    expect(doc.entities[a.id]).toBeDefined();
    expect(doc.entities[b.id]).toBeDefined();
  });

  it('promotes nested children to the parent group when deleted', () => {
    const a = addNode('A');
    const b = addNode('B');
    const inner = useDocumentStore.getState().createGroupFromSelection([a.id])!;
    useDocumentStore.getState().createGroupFromSelection([inner.id, b.id])!;
    const outer = Object.values(useDocumentStore.getState().doc.groups).find(
      (g) => g.id !== inner.id
    )!;
    // Sanity: outer holds [inner, b]
    expect(outer.memberIds).toEqual([inner.id, b.id]);
    // Delete inner — its [a] should end up in outer's memberIds in inner's slot.
    useDocumentStore.getState().deleteGroup(inner.id);
    const doc = useDocumentStore.getState().doc;
    expect(doc.groups[inner.id]).toBeUndefined();
    expect(doc.groups[outer.id]!.memberIds).toEqual([a.id, b.id]);
  });
});

describe('addToGroup cycle guard', () => {
  it('refuses to add a group to itself', () => {
    const a = addNode('A');
    const g = useDocumentStore.getState().createGroupFromSelection([a.id])!;
    useDocumentStore.getState().addToGroup(g.id, g.id);
    expect(useDocumentStore.getState().doc.groups[g.id]!.memberIds).toEqual([a.id]);
  });

  it('refuses to add an ancestor inside a descendant', () => {
    const a = addNode('A');
    const inner = useDocumentStore.getState().createGroupFromSelection([a.id])!;
    const outer = useDocumentStore.getState().createGroupFromSelection([inner.id])!;
    // outer is inner's ancestor; adding outer into inner would close a loop.
    useDocumentStore.getState().addToGroup(inner.id, outer.id);
    expect(useDocumentStore.getState().doc.groups[inner.id]!.memberIds).toEqual([a.id]);
  });
});

describe('hoist state', () => {
  it('hoistGroup sets hoistedGroupId and clears selection', () => {
    const a = addNode('A');
    const g = useDocumentStore.getState().createGroupFromSelection([a.id])!;
    useDocumentStore.getState().hoistGroup(g.id);
    const state = useDocumentStore.getState();
    expect(state.hoistedGroupId).toBe(g.id);
    expect(state.selection.kind).toBe('none');
  });

  it('unhoist clears hoistedGroupId', () => {
    const a = addNode('A');
    const g = useDocumentStore.getState().createGroupFromSelection([a.id])!;
    useDocumentStore.getState().hoistGroup(g.id);
    useDocumentStore.getState().unhoist();
    expect(useDocumentStore.getState().hoistedGroupId).toBeNull();
  });

  it('hoistGroup ignores an unknown id', () => {
    useDocumentStore.getState().hoistGroup('does-not-exist');
    expect(useDocumentStore.getState().hoistedGroupId).toBeNull();
  });
});

describe('entity deletion scrubs group membership', () => {
  it('deleteEntity removes the entity from any group it belonged to', () => {
    const a = addNode('A');
    const b = addNode('B');
    const g = useDocumentStore.getState().createGroupFromSelection([a.id, b.id])!;
    useDocumentStore.getState().deleteEntity(a.id);
    expect(useDocumentStore.getState().doc.groups[g.id]!.memberIds).toEqual([b.id]);
  });

  it('deleteEntitiesAndEdges scrubs every deleted entity from every group', () => {
    const a = addNode('A');
    const b = addNode('B');
    const c = addNode('C');
    const g = useDocumentStore.getState().createGroupFromSelection([a.id, b.id, c.id])!;
    useDocumentStore.getState().deleteEntitiesAndEdges([a.id, c.id], []);
    expect(useDocumentStore.getState().doc.groups[g.id]!.memberIds).toEqual([b.id]);
  });
});
