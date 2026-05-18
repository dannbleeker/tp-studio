import { describe, expect, it } from 'vitest';
import type { EdgeId, EntityId, GroupId } from '@/domain';
import {
  getSelectedIds,
  isMultiSelection,
  isSingleSelection,
  matchSelection,
} from '@/store/uiSlice/selectionHelpers';
import type { Selection } from '@/store/uiSlice/types';

describe('selection helpers', () => {
  const none: Selection = { kind: 'none' };
  const oneEntity: Selection = { kind: 'entities', ids: ['e1' as EntityId] };
  const twoEntities: Selection = {
    kind: 'entities',
    ids: ['e1' as EntityId, 'e2' as EntityId],
  };
  const oneEdge: Selection = { kind: 'edges', ids: ['eg1' as EdgeId] };
  const oneGroup: Selection = { kind: 'groups', ids: ['g1' as GroupId] };

  it('getSelectedIds returns the ids array regardless of kind', () => {
    expect(getSelectedIds(none)).toEqual([]);
    expect(getSelectedIds(oneEntity)).toEqual(['e1']);
    expect(getSelectedIds(twoEntities)).toEqual(['e1', 'e2']);
    expect(getSelectedIds(oneEdge)).toEqual(['eg1']);
    expect(getSelectedIds(oneGroup)).toEqual(['g1']);
  });

  it('isSingleSelection is true only when exactly one item is selected', () => {
    expect(isSingleSelection(none)).toBe(false);
    expect(isSingleSelection(oneEntity)).toBe(true);
    expect(isSingleSelection(twoEntities)).toBe(false);
    expect(isSingleSelection(oneEdge)).toBe(true);
    expect(isSingleSelection(oneGroup)).toBe(true);
  });

  it('isMultiSelection is true only when 2+ items are selected', () => {
    expect(isMultiSelection(none)).toBe(false);
    expect(isMultiSelection(oneEntity)).toBe(false);
    expect(isMultiSelection(twoEntities)).toBe(true);
    expect(isMultiSelection(oneEdge)).toBe(false);
  });

  it('matchSelection dispatches to the matching branch and types the parameter', () => {
    const label = (s: Selection): string =>
      matchSelection(s, {
        none: () => 'none',
        entities: (es) => `entities:${es.ids.length}`,
        edges: (eg) => `edges:${eg.ids.length}`,
        groups: (g) => `groups:${g.ids.length}`,
      });
    expect(label(none)).toBe('none');
    expect(label(oneEntity)).toBe('entities:1');
    expect(label(twoEntities)).toBe('entities:2');
    expect(label(oneEdge)).toBe('edges:1');
    expect(label(oneGroup)).toBe('groups:1');
  });
});
