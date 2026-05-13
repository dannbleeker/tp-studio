import { resetStoreForTest, useDocumentStore } from '@/store';
import { beforeEach, describe, expect, it } from 'vitest';
import { seedEntity } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);

/**
 * B7 — user-defined attributes on entities. The store exposes
 * `setEntityAttribute` (add/replace) and `removeEntityAttribute`.
 * Contracts under test:
 *
 *   - Add → entity carries the value.
 *   - Replace → same key, new value primitive.
 *   - Replace with same kind+value → no-op (history doesn't grow).
 *   - Remove last attribute → `attributes` collapses to undefined.
 *   - Operations on a non-existent entity are no-ops (no throw).
 */

const getEntity = (id: string) => useDocumentStore.getState().doc.entities[id];

describe('setEntityAttribute', () => {
  it('adds a new string attribute', () => {
    const e = seedEntity('A');
    useDocumentStore
      .getState()
      .setEntityAttribute(e.id, 'source', { kind: 'string', value: 'https://example.com' });
    expect(getEntity(e.id)?.attributes).toEqual({
      source: { kind: 'string', value: 'https://example.com' },
    });
  });

  it('adds attributes of all four kinds', () => {
    const e = seedEntity('A');
    const { setEntityAttribute } = useDocumentStore.getState();
    setEntityAttribute(e.id, 'note', { kind: 'string', value: 'hi' });
    setEntityAttribute(e.id, 'count', { kind: 'int', value: 7 });
    setEntityAttribute(e.id, 'prob', { kind: 'real', value: 0.8 });
    setEntityAttribute(e.id, 'done', { kind: 'bool', value: true });
    const attrs = getEntity(e.id)?.attributes;
    expect(attrs?.note).toEqual({ kind: 'string', value: 'hi' });
    expect(attrs?.count).toEqual({ kind: 'int', value: 7 });
    expect(attrs?.prob).toEqual({ kind: 'real', value: 0.8 });
    expect(attrs?.done).toEqual({ kind: 'bool', value: true });
  });

  it('replaces an existing value when the same key is set', () => {
    const e = seedEntity('A');
    const { setEntityAttribute } = useDocumentStore.getState();
    setEntityAttribute(e.id, 'count', { kind: 'int', value: 1 });
    setEntityAttribute(e.id, 'count', { kind: 'int', value: 42 });
    expect(getEntity(e.id)?.attributes?.count).toEqual({ kind: 'int', value: 42 });
  });

  it('is a no-op when the new value matches the existing one (history coalescing)', () => {
    const e = seedEntity('A');
    const { setEntityAttribute } = useDocumentStore.getState();
    setEntityAttribute(e.id, 'tag', { kind: 'string', value: 'urgent' });
    const past1 = useDocumentStore.getState().past.length;
    setEntityAttribute(e.id, 'tag', { kind: 'string', value: 'urgent' });
    const past2 = useDocumentStore.getState().past.length;
    expect(past2).toBe(past1);
  });

  it('does not throw when called on a non-existent entity', () => {
    expect(() =>
      useDocumentStore.getState().setEntityAttribute('ghost', 'x', { kind: 'string', value: 'y' })
    ).not.toThrow();
  });
});

describe('removeEntityAttribute', () => {
  it('removes the named key', () => {
    const e = seedEntity('A');
    const { setEntityAttribute, removeEntityAttribute } = useDocumentStore.getState();
    setEntityAttribute(e.id, 'a', { kind: 'int', value: 1 });
    setEntityAttribute(e.id, 'b', { kind: 'int', value: 2 });
    removeEntityAttribute(e.id, 'a');
    expect(getEntity(e.id)?.attributes).toEqual({ b: { kind: 'int', value: 2 } });
  });

  it('collapses attributes to undefined when the last key is removed', () => {
    const e = seedEntity('A');
    const { setEntityAttribute, removeEntityAttribute } = useDocumentStore.getState();
    setEntityAttribute(e.id, 'only', { kind: 'bool', value: false });
    removeEntityAttribute(e.id, 'only');
    expect(getEntity(e.id)?.attributes).toBeUndefined();
  });

  it('is a no-op when the key is absent', () => {
    const e = seedEntity('A');
    const before = useDocumentStore.getState().past.length;
    useDocumentStore.getState().removeEntityAttribute(e.id, 'ghost');
    const after = useDocumentStore.getState().past.length;
    expect(after).toBe(before);
  });

  it('does not throw when called on a non-existent entity', () => {
    expect(() => useDocumentStore.getState().removeEntityAttribute('ghost', 'x')).not.toThrow();
  });
});

describe('attribute persistence round-trip', () => {
  it('attributes survive exportToJSON / importFromJSON', async () => {
    const e = seedEntity('A');
    const { setEntityAttribute } = useDocumentStore.getState();
    setEntityAttribute(e.id, 'source', { kind: 'string', value: 'https://example.com' });
    setEntityAttribute(e.id, 'count', { kind: 'int', value: 12 });

    const { exportToJSON, importFromJSON } = await import('@/domain/persistence');
    const json = exportToJSON(useDocumentStore.getState().doc);
    const round = importFromJSON(json);
    const reloaded = Object.values(round.entities).find((x) => x.title === 'A');
    expect(reloaded?.attributes?.source).toEqual({ kind: 'string', value: 'https://example.com' });
    expect(reloaded?.attributes?.count).toEqual({ kind: 'int', value: 12 });
  });
});
