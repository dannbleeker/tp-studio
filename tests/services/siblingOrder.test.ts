import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { layoutSiblingOrder, moveEntityInSiblingOrder } from '@/services/siblingOrder';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../helpers/seedDoc';

/**
 * Session 193 — the UI-side setter for manual sibling ordering. It reads the
 * live canvas positions (mocked here) to find an entity's rank-siblings and
 * stamps a sequential `ordering` on the whole rank so a swap sticks.
 */

const h = vi.hoisted(() => ({
  nodes: [] as { id: string; type: string; position: { x: number; y: number } }[],
}));
vi.mock('@/services/canvasRef', () => ({
  getCanvasNodes: () => h.nodes,
}));

beforeEach(() => {
  resetStoreForTest();
  h.nodes.length = 0;
});
afterEach(() => vi.clearAllMocks());

const doc = () => useDocumentStore.getState().doc;
const at = (id: string, x: number, y: number) =>
  h.nodes.push({ id, type: 'tp', position: { x, y } });

describe('moveEntityInSiblingOrder', () => {
  it('swaps a node earlier and stamps sequential ordering on the whole rank', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const c = seedEntity('C');
    at(a.id, 0, 0);
    at(b.id, 100, 0);
    at(c.id, 200, 0); // same rank (y=0), left→right A, B, C

    expect(moveEntityInSiblingOrder(b.id, -1)).toBe(true);
    // New order B, A, C → ordering 1, 2, 3.
    expect(doc().entities[b.id]?.ordering).toBe(1);
    expect(doc().entities[a.id]?.ordering).toBe(2);
    expect(doc().entities[c.id]?.ordering).toBe(3);
  });

  it('moves a node later too', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    at(a.id, 0, 0);
    at(b.id, 100, 0);
    expect(moveEntityInSiblingOrder(a.id, 1)).toBe(true);
    expect(doc().entities[b.id]?.ordering).toBe(1);
    expect(doc().entities[a.id]?.ordering).toBe(2);
  });

  it('no-ops (false) when the node is already at the requested end', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    at(a.id, 0, 0);
    at(b.id, 100, 0);
    expect(moveEntityInSiblingOrder(a.id, -1)).toBe(false); // A is already leftmost
    expect(doc().entities[a.id]?.ordering).toBeUndefined();
  });

  it('no-ops when the node has no rank sibling (nodes on different ranks)', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    at(a.id, 0, 0);
    at(b.id, 0, 500); // different rank
    expect(layoutSiblingOrder(a.id)).toBeNull();
    expect(moveEntityInSiblingOrder(a.id, 1)).toBe(false);
  });

  it('does nothing on a manual-layout diagram (EC)', () => {
    useDocumentStore.getState().newDocument('ec');
    const ids = Object.keys(doc().entities);
    if (ids.length >= 2) {
      at(ids[0]!, 0, 0);
      at(ids[1]!, 100, 0);
      expect(moveEntityInSiblingOrder(ids[0]!, 1)).toBe(false);
    }
  });
});
