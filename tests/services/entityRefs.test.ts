import { navigateToEntity, resolveEntityRef } from '@/services/entityRefs';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { beforeEach, describe, expect, it } from 'vitest';
import { seedEntity } from '../helpers/seedDoc';

/**
 * `entityRefs` is the bridge between markdown links / search hits and
 * the document's entity selection. Two functions:
 *
 *   - `resolveEntityRef(s)` accepts raw ids or `#N` annotation refs.
 *   - `navigateToEntity(id)` expands collapsed ancestor groups,
 *     unhoists if the entity is outside the current hoist, then selects.
 *
 * Both are pure functions that read/write through `useDocumentStore`;
 * tests drive the store directly.
 */

beforeEach(resetStoreForTest);

describe('resolveEntityRef', () => {
  it('returns the id when ref is a plain entity id that exists', () => {
    const e = seedEntity('A');
    expect(resolveEntityRef(e.id)).toBe(e.id);
  });

  it('returns null when ref is a plain id that does not exist', () => {
    expect(resolveEntityRef('does-not-exist')).toBeNull();
  });

  it('resolves a #N annotation ref to the matching entity id', () => {
    const a = seedEntity('A'); // annotationNumber 1
    seedEntity('B'); // annotationNumber 2
    expect(resolveEntityRef('#1')).toBe(a.id);
  });

  it('returns null for an annotation ref with no matching entity', () => {
    seedEntity('A');
    expect(resolveEntityRef('#999')).toBeNull();
  });

  it('returns null for a malformed annotation ref', () => {
    expect(resolveEntityRef('#NaN')).toBeNull();
  });
});

describe('navigateToEntity', () => {
  it('selects the entity', () => {
    const e = seedEntity('A');
    navigateToEntity(e.id);
    const sel = useDocumentStore.getState().selection;
    expect(sel.kind).toBe('entities');
    if (sel.kind === 'entities') {
      expect(sel.ids).toContain(e.id);
    }
  });

  it('expands a collapsed ancestor group before selecting', () => {
    const e = seedEntity('A');
    const state = useDocumentStore.getState();
    const group = state.createGroupFromSelection([e.id]);
    if (!group) throw new Error('createGroupFromSelection returned null');
    state.toggleGroupCollapsed(group.id);
    expect(useDocumentStore.getState().doc.groups[group.id]?.collapsed).toBe(true);

    navigateToEntity(e.id);

    expect(useDocumentStore.getState().doc.groups[group.id]?.collapsed).toBe(false);
  });
});
