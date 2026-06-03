import { beforeEach, describe, expect, it } from 'vitest';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedAndGroupable } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);

/**
 * Bundle 8 / FL-ED3 + FL-ED4 — XOR and OR junctor groups mirror the AND
 * junctor model: same shape (group n≥2 edges sharing a target), separate
 * groupId field, separate visual junctor circle. An edge belongs to AT
 * MOST ONE junctor kind at a time.
 */

describe('groupAsOr', () => {
  it('groups ≥2 edges sharing a target', () => {
    const { c, e1, e2 } = seedAndGroupable();
    const result = useDocumentStore.getState().groupAsOr([e1.id, e2.id]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const after = useDocumentStore.getState().doc.edges;
    expect(after[e1.id]?.orGroupId).toBe(result.groupId);
    expect(after[e2.id]?.orGroupId).toBe(result.groupId);
    // Should not also set andGroupId or xorGroupId.
    expect(after[e1.id]?.andGroupId).toBeUndefined();
    expect(after[e1.id]?.xorGroupId).toBeUndefined();
    // Sanity: target preserved.
    expect(after[e1.id]?.targetId).toBe(c.id);
  });

  it('refuses to OR-group fewer than two edges', () => {
    const { e1 } = seedAndGroupable();
    const result = useDocumentStore.getState().groupAsOr([e1.id]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/at least two/i);
  });

  it('refuses when targets differ', () => {
    const state = useDocumentStore.getState();
    const a = state.addEntity({ type: 'effect', title: 'A' });
    const b = state.addEntity({ type: 'effect', title: 'B' });
    const c = state.addEntity({ type: 'effect', title: 'C' });
    const d = state.addEntity({ type: 'effect', title: 'D' });
    const e1 = state.connect(a.id, c.id);
    const e2 = state.connect(b.id, d.id);
    expect(e1 && e2).toBeTruthy();
    const result = useDocumentStore.getState().groupAsOr([e1!.id, e2!.id]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/same target/i);
  });
});

describe('groupAsXor', () => {
  it('groups ≥2 edges sharing a target', () => {
    const { e1, e2 } = seedAndGroupable();
    const result = useDocumentStore.getState().groupAsXor([e1.id, e2.id]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const after = useDocumentStore.getState().doc.edges;
    expect(after[e1.id]?.xorGroupId).toBe(result.groupId);
    expect(after[e2.id]?.xorGroupId).toBe(result.groupId);
  });
});

describe('cross-kind exclusivity', () => {
  it('refuses to OR-group edges that are already AND-grouped', () => {
    const { e1, e2 } = seedAndGroupable();
    const andResult = useDocumentStore.getState().groupAsAnd([e1.id, e2.id]);
    expect(andResult.ok).toBe(true);
    const orResult = useDocumentStore.getState().groupAsOr([e1.id, e2.id]);
    expect(orResult.ok).toBe(false);
    if (orResult.ok) return;
    expect(orResult.reason).toMatch(/different junctor group/i);
    // AND grouping survives the failed OR attempt.
    const after = useDocumentStore.getState().doc.edges;
    expect(after[e1.id]?.andGroupId).toBeDefined();
    expect(after[e1.id]?.orGroupId).toBeUndefined();
  });

  it('refuses to XOR-group edges that are already OR-grouped', () => {
    const { e1, e2 } = seedAndGroupable();
    useDocumentStore.getState().groupAsOr([e1.id, e2.id]);
    const xorResult = useDocumentStore.getState().groupAsXor([e1.id, e2.id]);
    expect(xorResult.ok).toBe(false);
  });

  it('after ungrouping AND, the same edges can be OR-grouped', () => {
    const { e1, e2 } = seedAndGroupable();
    const andResult = useDocumentStore.getState().groupAsAnd([e1.id, e2.id]);
    expect(andResult.ok).toBe(true);
    useDocumentStore.getState().ungroupAnd([e1.id, e2.id]);
    const orResult = useDocumentStore.getState().groupAsOr([e1.id, e2.id]);
    expect(orResult.ok).toBe(true);
  });
});

describe('ungroup actions only drop their own kind', () => {
  it('ungroupOr drops orGroupId but leaves the rest of the edge intact', () => {
    const { e1, e2 } = seedAndGroupable();
    useDocumentStore.getState().groupAsOr([e1.id, e2.id]);
    useDocumentStore.getState().updateEdge(e1.id, { label: 'because' });
    useDocumentStore.getState().ungroupOr([e1.id, e2.id]);
    const after = useDocumentStore.getState().doc.edges;
    expect(after[e1.id]?.orGroupId).toBeUndefined();
    expect(after[e1.id]?.label).toBe('because');
  });
});

describe('setEdgeWeight (FL-ED1)', () => {
  it('sets and clears the weight field', () => {
    const { e1 } = seedAndGroupable();
    useDocumentStore.getState().setEdgeWeight(e1.id, 'negative');
    expect(useDocumentStore.getState().doc.edges[e1.id]?.weight).toBe('negative');
    useDocumentStore.getState().setEdgeWeight(e1.id, undefined);
    expect(useDocumentStore.getState().doc.edges[e1.id]?.weight).toBeUndefined();
  });

  it('no-ops when the new weight matches the current weight (history-coalesce)', () => {
    const { e1 } = seedAndGroupable();
    useDocumentStore.getState().setEdgeWeight(e1.id, 'positive');
    const before = useDocumentStore.getState().doc.edges[e1.id]!.weight;
    useDocumentStore.getState().setEdgeWeight(e1.id, 'positive');
    const after = useDocumentStore.getState().doc.edges[e1.id]!.weight;
    expect(after).toBe(before);
  });

  it('persists across JSON round-trip', () => {
    const { e1 } = seedAndGroupable();
    useDocumentStore.getState().setEdgeWeight(e1.id, 'zero');
    const doc = useDocumentStore.getState().doc;
    const json = JSON.parse(JSON.stringify(doc));
    expect(json.edges[e1.id].weight).toBe('zero');
  });
});

// Session 171 — a junctor needs ≥2 inputs; dropping to one auto-collapses to a
// plain direct edge (no lonely "AND of one"). Enforced on the delete paths.
describe('auto-collapse single-member junctors', () => {
  it('ungroups the survivor when one co-cause edge is deleted', () => {
    const { e1, e2 } = seedAndGroupable();
    const grp = useDocumentStore.getState().groupAsAnd([e1.id, e2.id]);
    expect(grp.ok).toBe(true);
    expect(useDocumentStore.getState().doc.edges[e2.id]?.andGroupId).toBeTruthy();
    // Delete one co-cause → group has a single input left → auto-ungroup.
    useDocumentStore.getState().deleteEdge(e1.id);
    const after = useDocumentStore.getState().doc.edges;
    expect(after[e1.id]).toBeUndefined();
    expect(after[e2.id]?.andGroupId).toBeUndefined();
  });

  it('ungroups the survivor when a cause entity is deleted (edge cascade)', () => {
    const { a, e1, e2 } = seedAndGroupable();
    useDocumentStore.getState().groupAsAnd([e1.id, e2.id]);
    // Deleting cause A cascades its edge e1 away → group drops to e2 alone.
    useDocumentStore.getState().deleteEntity(a.id);
    const after = useDocumentStore.getState().doc.edges;
    expect(after[e1.id]).toBeUndefined();
    expect(after[e2.id]?.andGroupId).toBeUndefined();
  });
});
