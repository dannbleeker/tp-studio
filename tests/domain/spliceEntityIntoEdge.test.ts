import { resetStoreForTest, useDocumentStore } from '@/store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * Session 83 — `spliceEntityIntoEdge(entityId, edgeId)` takes an
 * existing entity and replaces a target edge with two new edges
 * routing through the entity. The entity's prior connections are
 * dropped. Tests cover the happy path, validation rejects, and
 * metadata preservation.
 */

describe('spliceEntityIntoEdge', () => {
  beforeEach(() => {
    resetStoreForTest();
  });
  afterEach(() => {
    resetStoreForTest();
  });

  const seed = () => {
    const a = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
    const b = useDocumentStore.getState().addEntity({ type: 'effect', title: 'B' });
    const c = useDocumentStore.getState().addEntity({ type: 'effect', title: 'C' });
    const ab = useDocumentStore.getState().connect(a.id, b.id);
    return { a, b, c, ab: ab! };
  };

  it('replaces the target edge with two halves through the entity', () => {
    const { a, b, c, ab } = seed();
    const ok = useDocumentStore.getState().spliceEntityIntoEdge(c.id, ab.id);
    expect(ok).toBe(true);
    const edges = Object.values(useDocumentStore.getState().doc.edges);
    expect(edges).toHaveLength(2);
    // One edge a → c, one edge c → b.
    expect(edges.some((e) => e.sourceId === a.id && e.targetId === c.id)).toBe(true);
    expect(edges.some((e) => e.sourceId === c.id && e.targetId === b.id)).toBe(true);
    // The original a → b edge is gone.
    expect(edges.some((e) => e.id === ab.id)).toBe(false);
  });

  it('drops the entity-being-spliced existing edges', () => {
    const { c, ab } = seed();
    // Connect c to some other entity so it has prior wiring.
    const d = useDocumentStore.getState().addEntity({ type: 'effect', title: 'D' });
    const cd = useDocumentStore.getState().connect(c.id, d.id);
    expect(cd).not.toBeNull();
    useDocumentStore.getState().spliceEntityIntoEdge(c.id, ab.id);
    const edges = Object.values(useDocumentStore.getState().doc.edges);
    // c → d should be gone (entity's prior wiring dropped); a → c and c → b remain.
    expect(edges.some((e) => e.sourceId === c.id && e.targetId === d.id)).toBe(false);
    expect(edges).toHaveLength(2);
  });

  it('preserves label / assumptions / isBackEdge on the downstream half', () => {
    const { a, b, c, ab } = seed();
    useDocumentStore.getState().updateEdge(ab.id, {
      label: 'because',
      isBackEdge: true,
    });
    useDocumentStore.getState().spliceEntityIntoEdge(c.id, ab.id);
    const downstream = Object.values(useDocumentStore.getState().doc.edges).find(
      (e) => e.sourceId === c.id && e.targetId === b.id
    );
    expect(downstream).toBeDefined();
    expect(downstream!.label).toBe('because');
    expect(downstream!.isBackEdge).toBe(true);
    // Upstream half stays clean — no inherited metadata.
    const upstream = Object.values(useDocumentStore.getState().doc.edges).find(
      (e) => e.sourceId === a.id && e.targetId === c.id
    );
    expect(upstream!.label).toBeUndefined();
    expect(upstream!.isBackEdge).toBeUndefined();
  });

  it('rejects splicing an entity that is already an endpoint of the edge', () => {
    const { a, b, ab } = seed();
    expect(useDocumentStore.getState().spliceEntityIntoEdge(a.id, ab.id)).toBe(false);
    expect(useDocumentStore.getState().spliceEntityIntoEdge(b.id, ab.id)).toBe(false);
    // The edge stays put.
    expect(useDocumentStore.getState().doc.edges[ab.id]).toBeDefined();
  });

  it('returns false when the entity or edge does not exist', () => {
    const { c, ab } = seed();
    expect(useDocumentStore.getState().spliceEntityIntoEdge('ghost', ab.id)).toBe(false);
    expect(useDocumentStore.getState().spliceEntityIntoEdge(c.id, 'ghost')).toBe(false);
  });
});
