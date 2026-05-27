import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedConnectedPair, seedEntity } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);
afterEach(resetStoreForTest);

const doc = () => useDocumentStore.getState().doc;

describe('store.addCoCauseToEdge', () => {
  it('joins a new source into an existing edge as an AND-grouped co-cause', () => {
    const { a, b, edge } = seedConnectedPair('Cause A', 'Effect B');
    const c = seedEntity('Cause C');
    const result = useDocumentStore.getState().addCoCauseToEdge(edge.id, c.id);
    expect(result).not.toBeNull();
    const after = doc();
    // Original edge should now carry an andGroupId.
    expect(after.edges[edge.id]?.andGroupId).toBeTruthy();
    // New edge should target B with the same andGroupId.
    const newEdge = Object.values(after.edges).find(
      (e) => e.sourceId === c.id && e.targetId === b.id
    );
    expect(newEdge).toBeTruthy();
    expect(newEdge?.andGroupId).toBe(after.edges[edge.id]?.andGroupId);
    // a is unaffected.
    expect(a.id).toBeDefined();
  });

  it('joins an existing AND group rather than minting a new one', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const c = seedEntity('C');
    const state = useDocumentStore.getState();
    const e1 = state.connect(a.id, c.id);
    const e2 = state.connect(b.id, c.id);
    if (!e1 || !e2) return;
    const grouped = state.groupAsAnd([e1.id, e2.id]);
    expect(grouped.ok).toBe(true);
    const groupId = doc().edges[e1.id]?.andGroupId;
    expect(groupId).toBeTruthy();
    // Add a third co-cause via the splice-style action.
    const d = seedEntity('D');
    const result = useDocumentStore.getState().addCoCauseToEdge(e1.id, d.id);
    expect(result).not.toBeNull();
    expect(result?.andGroupId).toBe(groupId);
  });

  it('returns null when source already feeds the same target', () => {
    const { a, b } = seedConnectedPair();
    // a already connects to b.
    const result = useDocumentStore
      .getState()
      .addCoCauseToEdge(Object.keys(doc().edges)[0] ?? '', a.id);
    expect(result).toBeNull();
    expect(b.id).toBeDefined();
  });

  it('returns null when source equals the target', () => {
    const { b, edge } = seedConnectedPair();
    const result = useDocumentStore.getState().addCoCauseToEdge(edge.id, b.id);
    expect(result).toBeNull();
  });

  it('returns null for an assumption-typed source', () => {
    const { edge } = seedConnectedPair();
    const assn = seedEntity('Note', 'assumption');
    const result = useDocumentStore.getState().addCoCauseToEdge(edge.id, assn.id);
    expect(result).toBeNull();
  });

  it('returns null for a missing edge id', () => {
    const c = seedEntity('C');
    const result = useDocumentStore.getState().addCoCauseToEdge('no-such-edge', c.id);
    expect(result).toBeNull();
  });
});

// Session 137 — OR / XOR drag-create on junctor circles. Same shape
// as AND but stamps the OR / XOR group field instead. Cross-kind
// exclusivity is preserved: trying to add a co-cause of one kind to
// an edge that already belongs to a different kind returns null.

describe('store.addCoCauseToEdge — OR junctor', () => {
  it('mints a fresh OR group when adding to a solo edge', () => {
    const { b, edge } = seedConnectedPair('Cause A', 'Effect B');
    const c = seedEntity('Cause C');
    const result = useDocumentStore.getState().addCoCauseToEdge(edge.id, c.id, 'or');
    expect(result).not.toBeNull();
    const after = doc();
    // Existing edge gains an orGroupId; no andGroupId or xorGroupId.
    const existing = after.edges[edge.id];
    expect(existing?.orGroupId).toBeTruthy();
    expect(existing?.andGroupId).toBeUndefined();
    expect(existing?.xorGroupId).toBeUndefined();
    // New edge targets B with the same orGroupId.
    const newEdge = Object.values(after.edges).find(
      (e) => e.sourceId === c.id && e.targetId === b.id
    );
    expect(newEdge?.orGroupId).toBe(existing?.orGroupId);
    expect(newEdge?.andGroupId).toBeUndefined();
    expect(newEdge?.xorGroupId).toBeUndefined();
    // Mint id encodes the kind for grep-friendliness.
    expect(existing?.orGroupId?.startsWith('or_')).toBe(true);
  });

  it('joins an existing OR group rather than minting a new one', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const c = seedEntity('C');
    const state = useDocumentStore.getState();
    const e1 = state.connect(a.id, c.id);
    const e2 = state.connect(b.id, c.id);
    if (!e1 || !e2) return;
    const grouped = state.groupAsOr([e1.id, e2.id]);
    expect(grouped.ok).toBe(true);
    const groupId = doc().edges[e1.id]?.orGroupId;
    expect(groupId).toBeTruthy();
    const d = seedEntity('D');
    const result = useDocumentStore.getState().addCoCauseToEdge(e1.id, d.id, 'or');
    expect(result?.orGroupId).toBe(groupId);
  });

  it('refuses to add an OR co-cause to an AND-grouped edge (cross-kind exclusivity)', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const c = seedEntity('C');
    const state = useDocumentStore.getState();
    const e1 = state.connect(a.id, c.id);
    const e2 = state.connect(b.id, c.id);
    if (!e1 || !e2) return;
    state.groupAsAnd([e1.id, e2.id]);
    expect(doc().edges[e1.id]?.andGroupId).toBeTruthy();
    const d = seedEntity('D');
    const result = useDocumentStore.getState().addCoCauseToEdge(e1.id, d.id, 'or');
    expect(result).toBeNull();
  });
});

describe('store.addCoCauseToEdge — XOR junctor', () => {
  it('mints a fresh XOR group when adding to a solo edge', () => {
    const { b, edge } = seedConnectedPair('Cause A', 'Effect B');
    const c = seedEntity('Cause C');
    const result = useDocumentStore.getState().addCoCauseToEdge(edge.id, c.id, 'xor');
    expect(result).not.toBeNull();
    const after = doc();
    const existing = after.edges[edge.id];
    expect(existing?.xorGroupId).toBeTruthy();
    expect(existing?.andGroupId).toBeUndefined();
    expect(existing?.orGroupId).toBeUndefined();
    const newEdge = Object.values(after.edges).find(
      (e) => e.sourceId === c.id && e.targetId === b.id
    );
    expect(newEdge?.xorGroupId).toBe(existing?.xorGroupId);
    expect(existing?.xorGroupId?.startsWith('xor_')).toBe(true);
  });

  it('joins an existing XOR group rather than minting a new one', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const c = seedEntity('C');
    const state = useDocumentStore.getState();
    const e1 = state.connect(a.id, c.id);
    const e2 = state.connect(b.id, c.id);
    if (!e1 || !e2) return;
    state.groupAsXor([e1.id, e2.id]);
    const groupId = doc().edges[e1.id]?.xorGroupId;
    expect(groupId).toBeTruthy();
    const d = seedEntity('D');
    const result = useDocumentStore.getState().addCoCauseToEdge(e1.id, d.id, 'xor');
    expect(result?.xorGroupId).toBe(groupId);
  });

  it('refuses to add an XOR co-cause to an OR-grouped edge (cross-kind exclusivity)', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const c = seedEntity('C');
    const state = useDocumentStore.getState();
    const e1 = state.connect(a.id, c.id);
    const e2 = state.connect(b.id, c.id);
    if (!e1 || !e2) return;
    state.groupAsOr([e1.id, e2.id]);
    const d = seedEntity('D');
    const result = useDocumentStore.getState().addCoCauseToEdge(e1.id, d.id, 'xor');
    expect(result).toBeNull();
  });

  it('refuses to add an AND co-cause to an XOR-grouped edge (cross-kind exclusivity)', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const c = seedEntity('C');
    const state = useDocumentStore.getState();
    const e1 = state.connect(a.id, c.id);
    const e2 = state.connect(b.id, c.id);
    if (!e1 || !e2) return;
    state.groupAsXor([e1.id, e2.id]);
    const d = seedEntity('D');
    // Default kind is 'and' — should refuse against an XOR edge.
    const result = useDocumentStore.getState().addCoCauseToEdge(e1.id, d.id);
    expect(result).toBeNull();
  });
});
