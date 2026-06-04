import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);
afterEach(resetStoreForTest);

const docState = () => useDocumentStore.getState().doc;

describe('back-edge flag', () => {
  it('flag survives a JSON round-trip', async () => {
    const { exportToJSON, importFromJSON } = await import('@/domain/persistence');
    const a = seedEntity('A');
    const b = seedEntity('B');
    const state = useDocumentStore.getState();
    state.connect(a.id, b.id);
    const back = state.connect(b.id, a.id);
    if (!back) return;
    useDocumentStore.getState().updateEdge(back.id, { isBackEdge: true });
    const json = exportToJSON(docState());
    const doc = importFromJSON(json);
    expect(doc.edges[back.id]?.isBackEdge).toBe(true);
  });
});
