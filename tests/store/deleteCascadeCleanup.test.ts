import { beforeEach, describe, expect, it } from 'vitest';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedConnectedPair, seedEntity } from '../helpers/seedDoc';

/**
 * B2 — deleting the currently hoisted group must exit hoist; otherwise
 * `hoistedGroupId` dangles and the canvas projects an empty descendant set
 * (a stuck blank canvas).
 *
 * B3/B4 — deleting an edge (or an entity, which cascades to its edges) must
 * prune the first-class `doc.assumptions` records that annotated those edges,
 * and scrub deleted injection entities from surviving assumptions'
 * `injectionIds`. Otherwise dangling records accumulate and survive export.
 */
beforeEach(resetStoreForTest);

const s = () => useDocumentStore.getState();

describe('deleteGroup clears a stale hoist (B2)', () => {
  it('exits hoist when the hoisted group itself is deleted', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const g = s().createGroupFromSelection([a.id, b.id]);
    if (!g) throw new Error('group setup failed');

    s().hoistGroup(g.id);
    expect(s().hoistedGroupId).toBe(g.id);

    s().deleteGroup(g.id);
    expect(s().hoistedGroupId).toBeNull();
  });

  it('leaves the hoist intact when a DIFFERENT group is deleted', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const c = seedEntity('C');
    const d = seedEntity('D');
    const g1 = s().createGroupFromSelection([a.id, b.id]);
    const g2 = s().createGroupFromSelection([c.id, d.id]);
    if (!g1 || !g2) throw new Error('group setup failed');

    s().hoistGroup(g1.id);
    s().deleteGroup(g2.id);
    expect(s().hoistedGroupId).toBe(g1.id);
  });
});

describe('delete prunes orphaned assumptions (B3) + scrubs injectionIds (B4)', () => {
  it('drops the assumption record when its host edge is deleted', () => {
    const { edge } = seedConnectedPair();
    const asm = s().addAssumptionToEdge(edge.id, 'Because X');
    if (!asm) throw new Error('addAssumptionToEdge failed');
    expect(s().doc.assumptions?.[asm.id]).toBeDefined();

    s().deleteEdge(edge.id);
    expect(s().doc.assumptions?.[asm.id]).toBeUndefined();
  });

  it('drops the assumption when the host edge cascades away via entity delete', () => {
    const { a, edge } = seedConnectedPair();
    const asm = s().addAssumptionToEdge(edge.id, 'Because X');
    if (!asm) throw new Error('addAssumptionToEdge failed');

    s().deleteEntity(a.id); // removes the a→b edge, orphaning the assumption
    expect(s().doc.edges[edge.id]).toBeUndefined();
    expect(s().doc.assumptions?.[asm.id]).toBeUndefined();
  });

  it('scrubs a deleted injection entity from a surviving assumption (B4)', () => {
    const { edge } = seedConnectedPair();
    const asm = s().addAssumptionToEdge(edge.id, 'Because X');
    if (!asm) throw new Error('addAssumptionToEdge failed');
    const injection = seedEntity('Injection');
    s().linkInjectionToAssumption(asm.id, injection.id);
    expect(s().doc.assumptions?.[asm.id]?.injectionIds).toEqual([injection.id]);

    s().deleteEntity(injection.id);
    // The assumption survives (its host edge is intact) but the now-dangling
    // injection link is scrubbed (field omitted once the array empties).
    expect(s().doc.assumptions?.[asm.id]).toBeDefined();
    expect(s().doc.assumptions?.[asm.id]?.injectionIds).toBeUndefined();
  });

  it('leaves an unrelated assumption intact when a different edge is deleted', () => {
    const pair1 = seedConnectedPair('A', 'B');
    const pair2 = seedConnectedPair('C', 'D');
    const asm = s().addAssumptionToEdge(pair1.edge.id, 'keep me');
    if (!asm) throw new Error('addAssumptionToEdge failed');

    s().deleteEdge(pair2.edge.id);
    expect(s().doc.assumptions?.[asm.id]).toBeDefined();
  });
});
