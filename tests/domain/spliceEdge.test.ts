import { resetStoreForTest, useDocumentStore } from '@/store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seedConnectedPair, seedEntity } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);
afterEach(resetStoreForTest);

const docState = () => useDocumentStore.getState().doc;

describe('store.spliceEdge', () => {
  it('replaces the edge with two new edges through a new entity', () => {
    const { a, b, edge } = seedConnectedPair('Cause', 'Effect');
    const newEntity = useDocumentStore.getState().spliceEdge(edge.id);
    expect(newEntity).not.toBeNull();
    const doc = docState();
    // Old edge gone.
    expect(doc.edges[edge.id]).toBeUndefined();
    // Three entities total now (the two original + the new one).
    expect(Object.keys(doc.entities)).toHaveLength(3);
    // Two new edges: a → new, new → b.
    const newEdges = Object.values(doc.edges);
    expect(newEdges).toHaveLength(2);
    const upstream = newEdges.find((e) => e.sourceId === a.id);
    const downstream = newEdges.find((e) => e.targetId === b.id);
    expect(upstream?.targetId).toBe(newEntity?.id);
    expect(downstream?.sourceId).toBe(newEntity?.id);
  });

  it('selects the new entity and enters edit mode on it', () => {
    const { edge } = seedConnectedPair();
    const newEntity = useDocumentStore.getState().spliceEdge(edge.id);
    const state = useDocumentStore.getState();
    expect(state.selection).toEqual({ kind: 'entities', ids: [newEntity?.id] });
    expect(state.editingEntityId).toBe(newEntity?.id);
  });

  it('inherits label, assumptions, and back-edge flag onto the downstream half only', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const edge = useDocumentStore.getState().connect(a.id, b.id);
    expect(edge).not.toBeNull();
    if (!edge) return;
    // Stamp label and back-edge onto the edge.
    useDocumentStore.getState().updateEdge(edge.id, { label: 'within 1 week', isBackEdge: true });
    // Attach an assumption so we have an assumptionIds list to migrate.
    const assn = useDocumentStore.getState().addAssumptionToEdge(edge.id);
    expect(assn).not.toBeNull();

    const newEntity = useDocumentStore.getState().spliceEdge(edge.id);
    expect(newEntity).not.toBeNull();
    if (!newEntity) return;
    const doc = docState();
    const upstream = Object.values(doc.edges).find((e) => e.sourceId === a.id);
    const downstream = Object.values(doc.edges).find((e) => e.targetId === b.id);
    // Downstream half carries the semantic baggage:
    expect(downstream?.label).toBe('within 1 week');
    expect(downstream?.isBackEdge).toBe(true);
    expect(downstream?.assumptionIds).toEqual([assn?.id]);
    // Upstream half is clean:
    expect(upstream?.label).toBeUndefined();
    expect(upstream?.isBackEdge).toBeUndefined();
    expect(upstream?.assumptionIds).toBeUndefined();
  });

  it('drops AND grouping on the original edge (user can re-AND if desired)', () => {
    // a + b → c with a→c and b→c AND-grouped.
    const a = seedEntity('A');
    const b = seedEntity('B');
    const c = seedEntity('C');
    const state = useDocumentStore.getState();
    const e1 = state.connect(a.id, c.id);
    const e2 = state.connect(b.id, c.id);
    if (!e1 || !e2) return;
    const grp = state.groupAsAnd([e1.id, e2.id]);
    expect(grp.ok).toBe(true);
    // Splice the a→c edge.
    const newEntity = useDocumentStore.getState().spliceEdge(e1.id);
    expect(newEntity).not.toBeNull();
    const doc = docState();
    // The remaining b→c edge keeps its andGroupId (the group's other member
    // is still around — group reduction to 1 member is structurally allowed
    // and the user can re-AND with the new splice path if they want).
    expect(doc.edges[e2.id]?.andGroupId).toBeTruthy();
    // The two new edges (a→new, new→c) carry NO andGroupId.
    const newEdges = Object.values(doc.edges).filter((e) => e.id !== e2.id);
    for (const ne of newEdges) {
      expect(ne.andGroupId).toBeUndefined();
    }
  });

  it('returns null on a missing edge id', () => {
    const result = useDocumentStore.getState().spliceEdge('no-such-edge');
    expect(result).toBeNull();
  });

  it('increments nextAnnotationNumber by one', () => {
    const { edge } = seedConnectedPair();
    const before = docState().nextAnnotationNumber;
    useDocumentStore.getState().spliceEdge(edge.id);
    const after = docState().nextAnnotationNumber;
    expect(after).toBe(before + 1);
  });
});
