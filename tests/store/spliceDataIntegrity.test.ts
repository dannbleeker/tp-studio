import { describe, expect, it } from 'vitest';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedConnectedPair } from '../helpers/seedDoc';

/**
 * Splicing an entity into an edge replaces that edge with two halves. The
 * downstream half is the semantic continuation (it inherits the edge's label +
 * assumptionIds), so the edge's comments + assumption records must follow it
 * rather than orphan on the now-deleted edge id (which would also zero the count
 * badge and get the records dropped by the next prune).
 */
const s = () => useDocumentStore.getState();

describe('splice re-homes an edge’s comments + assumptions to the downstream half', () => {
  it('spliceEdge keeps the edge comment + assumption on the downstream edge', () => {
    resetStoreForTest();
    const { edge } = seedConnectedPair();
    const originalTarget = edge.targetId;
    s().addComment({ kind: 'edge', edgeId: edge.id }, 'about this step');
    const assumptionEntity = s().addAssumptionToEdge(edge.id);
    expect(assumptionEntity).not.toBeNull();
    const aid = assumptionEntity!.id;

    const newEntity = s().spliceEdge(edge.id);
    expect(newEntity).not.toBeNull();

    const doc = s().doc;
    expect(doc.edges[edge.id]).toBeUndefined(); // original edge gone
    const downstream = Object.values(doc.edges).find(
      (e) => e.sourceId === newEntity!.id && e.targetId === originalTarget
    );
    expect(downstream).toBeDefined();

    // Comment survived + re-anchored to the downstream edge (not orphaned).
    const edgeComments = Object.values(doc.comments ?? {}).filter((c) => c.anchor.kind === 'edge');
    expect(edgeComments).toHaveLength(1);
    const c = edgeComments[0]!;
    if (c.anchor.kind === 'edge') expect(c.anchor.edgeId).toBe(downstream!.id);

    // Assumption record survived + re-homed to the downstream edge, which still
    // lists it — so the count badge resolves and the next prune won't drop it.
    expect(doc.assumptions?.[aid]?.edgeId).toBe(downstream!.id);
    expect(downstream!.assumptionIds).toContain(aid);
  });

  it('spliceEntityIntoEdge keeps the edge comment on the downstream edge', () => {
    resetStoreForTest();
    const { edge } = seedConnectedPair();
    const originalTarget = edge.targetId;
    s().addComment({ kind: 'edge', edgeId: edge.id }, 'about this step');
    const mid = s().addEntity({ type: 'effect', title: 'Mid' });

    expect(s().spliceEntityIntoEdge(mid.id, edge.id)).toBe(true);

    const doc = s().doc;
    const downstream = Object.values(doc.edges).find(
      (e) => e.sourceId === mid.id && e.targetId === originalTarget
    );
    expect(downstream).toBeDefined();
    const edgeComments = Object.values(doc.comments ?? {}).filter((c) => c.anchor.kind === 'edge');
    expect(edgeComments).toHaveLength(1);
    const c = edgeComments[0]!;
    if (c.anchor.kind === 'edge') expect(c.anchor.edgeId).toBe(downstream!.id);
  });
});
