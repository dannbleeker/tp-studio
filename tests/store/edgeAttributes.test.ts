import { beforeEach, describe, expect, it } from 'vitest';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);

/**
 * B1 — user-defined attributes on EDGES (mirrors the entity-attribute slate in
 * `entityAttributes.test.ts`). `setEdgeAttribute` (add / replace, with a
 * same-value coalescing no-op) + `removeEdgeAttribute` (remove a key; collapse
 * the `attributes` field to undefined via the emit-or-omit pattern when the map
 * empties). Ghost edge / absent key = no-op (no throw, no history growth).
 */

const connectEdge = (): string => {
  const a = seedEntity('A');
  const b = seedEntity('B');
  const edge = useDocumentStore.getState().connect(a.id, b.id);
  if (!edge) throw new Error('edge not created');
  return edge.id;
};

const getEdge = (id: string) => useDocumentStore.getState().doc.edges[id];

describe('setEdgeAttribute', () => {
  it('adds a new attribute', () => {
    const id = connectEdge();
    useDocumentStore.getState().setEdgeAttribute(id, 'priority', { kind: 'string', value: 'high' });
    expect(getEdge(id)?.attributes).toEqual({ priority: { kind: 'string', value: 'high' } });
  });

  it('replaces an existing value for the same key', () => {
    const id = connectEdge();
    const { setEdgeAttribute } = useDocumentStore.getState();
    setEdgeAttribute(id, 'weight', { kind: 'int', value: 1 });
    setEdgeAttribute(id, 'weight', { kind: 'int', value: 9 });
    expect(getEdge(id)?.attributes?.weight).toEqual({ kind: 'int', value: 9 });
  });

  it('is a no-op when the new value matches the existing one (history coalescing)', () => {
    const id = connectEdge();
    const { setEdgeAttribute } = useDocumentStore.getState();
    setEdgeAttribute(id, 'tag', { kind: 'string', value: 'x' });
    const before = useDocumentStore.getState().past.length;
    setEdgeAttribute(id, 'tag', { kind: 'string', value: 'x' });
    expect(useDocumentStore.getState().past.length).toBe(before);
  });

  it('does not throw on a non-existent edge', () => {
    expect(() =>
      useDocumentStore.getState().setEdgeAttribute('ghost', 'x', { kind: 'bool', value: true })
    ).not.toThrow();
  });
});

describe('removeEdgeAttribute', () => {
  it('removes the named key, keeping the others', () => {
    const id = connectEdge();
    const { setEdgeAttribute, removeEdgeAttribute } = useDocumentStore.getState();
    setEdgeAttribute(id, 'a', { kind: 'int', value: 1 });
    setEdgeAttribute(id, 'b', { kind: 'int', value: 2 });
    removeEdgeAttribute(id, 'a');
    expect(getEdge(id)?.attributes).toEqual({ b: { kind: 'int', value: 2 } });
  });

  it('collapses attributes to undefined when the last key is removed', () => {
    const id = connectEdge();
    const { setEdgeAttribute, removeEdgeAttribute } = useDocumentStore.getState();
    setEdgeAttribute(id, 'only', { kind: 'bool', value: false });
    removeEdgeAttribute(id, 'only');
    expect(getEdge(id)?.attributes).toBeUndefined();
  });

  it('is a no-op when the key is absent', () => {
    const id = connectEdge();
    const before = useDocumentStore.getState().past.length;
    useDocumentStore.getState().removeEdgeAttribute(id, 'ghost');
    expect(useDocumentStore.getState().past.length).toBe(before);
  });

  it('does not throw on a non-existent edge', () => {
    expect(() => useDocumentStore.getState().removeEdgeAttribute('ghost', 'x')).not.toThrow();
  });
});
