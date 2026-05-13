import { resetStoreForTest, useDocumentStore } from '@/store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seedEntity } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);
afterEach(resetStoreForTest);

const doc = () => useDocumentStore.getState().doc;

describe('LA5 — pinned positions for auto-layout diagrams', () => {
  it('setEntityPosition persists a position on a CRT entity', () => {
    const e = seedEntity('A');
    useDocumentStore.getState().setEntityPosition(e.id, { x: 100, y: 200 });
    expect(doc().entities[e.id]?.position).toEqual({ x: 100, y: 200 });
  });

  it('setEntityPosition(null) clears the pin', () => {
    const e = seedEntity('A');
    const s = useDocumentStore.getState();
    s.setEntityPosition(e.id, { x: 100, y: 200 });
    s.setEntityPosition(e.id, null);
    expect(doc().entities[e.id]?.position).toBeUndefined();
  });

  it('clearAllEntityPositions removes positions from every entity and returns the count', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const c = seedEntity('C');
    const s = useDocumentStore.getState();
    s.setEntityPosition(a.id, { x: 1, y: 1 });
    s.setEntityPosition(b.id, { x: 2, y: 2 });
    // c stays unpinned
    const cleared = s.clearAllEntityPositions();
    expect(cleared).toBe(2);
    expect(doc().entities[a.id]?.position).toBeUndefined();
    expect(doc().entities[b.id]?.position).toBeUndefined();
    expect(doc().entities[c.id]?.position).toBeUndefined();
  });

  it('clearAllEntityPositions returns 0 when no entities are pinned (no-op)', () => {
    seedEntity('A');
    seedEntity('B');
    const before = doc();
    const cleared = useDocumentStore.getState().clearAllEntityPositions();
    expect(cleared).toBe(0);
    // No-op: doc reference unchanged.
    expect(doc()).toBe(before);
  });

  it('pinned positions survive a JSON round-trip', async () => {
    const { exportToJSON, importFromJSON } = await import('@/domain/persistence');
    const e = seedEntity('A');
    useDocumentStore.getState().setEntityPosition(e.id, { x: 99, y: 42 });
    const json = exportToJSON(doc());
    const restored = importFromJSON(json);
    expect(restored.entities[e.id]?.position).toEqual({ x: 99, y: 42 });
  });
});
