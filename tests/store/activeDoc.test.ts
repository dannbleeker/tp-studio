import { describe, expect, it } from 'vitest';
import type { DocumentId, TPDocument } from '@/domain/types';
import { type ActiveDocFields, setActiveDoc } from '@/store/activeDoc';
import { makeDoc } from '../domain/helpers';

const doc = (id: string): TPDocument => ({ ...makeDoc([], []), id: id as DocumentId });

const state = (active: TPDocument, tabs: TPDocument[], tabOrder: string[]): ActiveDocFields => ({
  doc: active,
  docs: Object.fromEntries(tabs.map((d) => [d.id, d])) as Record<DocumentId, TPDocument>,
  activeDocId: active.id,
  tabOrder: tabOrder as DocumentId[],
});

describe('setActiveDoc', () => {
  it('replaces the active tab in place when the id is unchanged', () => {
    const a = doc('A');
    const a2 = { ...a, title: 'edited' };
    const next = setActiveDoc(state(a, [a], ['A']), a2);
    expect(next.tabOrder).toEqual(['A']);
    expect(next.docs['A' as DocumentId]).toBe(a2);
  });

  it('rekeys the active tab in place, keeping its position and dropping the old id', () => {
    const a = doc('A');
    const b = doc('B');
    const c = doc('C');
    const next = setActiveDoc(state(a, [a, b], ['A', 'B']), c);
    expect(next.tabOrder).toEqual(['C', 'B']);
    expect(next.activeDocId).toBe('C');
    expect(Object.keys(next.docs).sort()).toEqual(['B', 'C']);
  });

  it('does not duplicate a tab id when rekeying to a doc whose id matches another open tab', () => {
    // Active tab X, background tab B. A replace-mode load of a doc whose id is B
    // collides with the open B tab — the naive rekey map produced ['B', 'B'].
    const x = doc('X');
    const b = doc('B');
    const loadedB = { ...doc('B'), title: 'loaded' };
    const next = setActiveDoc(state(x, [x, b], ['X', 'B']), loadedB);
    expect(new Set(next.tabOrder).size).toBe(next.tabOrder.length); // no duplicates
    expect(next.tabOrder).toEqual(['B']);
    expect(next.activeDocId).toBe('B');
    expect(next.docs['B' as DocumentId]).toBe(loadedB);
  });
});
