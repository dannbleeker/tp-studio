import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useGraphProjection } from '@/components/canvas/hooks/useGraphProjection';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { makeDoc, makeEdge, makeEntity, resetIds } from '../../domain/helpers';

beforeEach(() => {
  resetStoreForTest();
  resetIds();
});

/** Render `useGraphProjection` against the live store doc so store edits trigger
 *  a re-render (the memo-identity check needs a changing `doc` reference). */
const renderProjection = () => renderHook(() => useGraphProjection(useDocumentStore((s) => s.doc)));

/**
 * `useGraphProjection` is keyed on `entityCollapseSignature` (id + F7 collapse) +
 * `doc.edges` + groups + hoist/archived — NOT the raw `doc.entities` reference.
 * So a non-structural entity edit reuses the cached projection, while anything
 * that moves the visible set (collapse, add/remove, an edge under a collapser)
 * recomputes. Session 191 added `doc.edges` to the deps, fixing a stale
 * F7-collapse hidden set when an edge changed under a collapsed entity.
 */
describe('useGraphProjection — memoization gate', () => {
  it('holds the projection reference across a title-only edit', () => {
    const a = makeEntity({ collapsed: true });
    const b = makeEntity();
    useDocumentStore.getState().setDocument(makeDoc([a, b], [makeEdge(a.id, b.id)]));
    const { result } = renderProjection();
    const before = result.current;
    act(() => {
      useDocumentStore.getState().updateEntity(b.id, { title: 'a much longer renamed title' });
    });
    expect(result.current).toBe(before);
  });

  it('recomputes when an entity collapse toggles', () => {
    const a = makeEntity();
    const b = makeEntity();
    useDocumentStore.getState().setDocument(makeDoc([a, b], [makeEdge(a.id, b.id)]));
    const { result } = renderProjection();
    const before = result.current;
    act(() => {
      useDocumentStore.getState().toggleEntityCollapsed(a.id);
    });
    expect(result.current).not.toBe(before);
    expect(result.current.visibleEntityIds.has(b.id)).toBe(false); // b now hidden behind a
  });

  it('recomputes when an entity is added', () => {
    const a = makeEntity();
    useDocumentStore.getState().setDocument(makeDoc([a], []));
    const { result } = renderProjection();
    const before = result.current;
    act(() => {
      useDocumentStore.getState().addEntity({ type: 'effect' });
    });
    expect(result.current).not.toBe(before);
  });

  it('recomputes the hidden set when an edge is added under a collapsed entity (Session 191 fix)', () => {
    // A is collapsed and feeds B; C exists but is NOT yet downstream of A.
    const a = makeEntity({ collapsed: true });
    const b = makeEntity();
    const c = makeEntity();
    useDocumentStore.getState().setDocument(makeDoc([a, b, c], [makeEdge(a.id, b.id)]));
    const { result } = renderProjection();
    expect(result.current.hiddenCountByCollapser.get(a.id)).toBe(1); // only B hidden

    // An EDGE-ONLY change (B → C, both already present): doc.edges changes but
    // doc.entities does not. Before the edges dep, the memo held and the hidden
    // count stayed stale at 1.
    act(() => {
      useDocumentStore.getState().connect(b.id, c.id);
    });
    expect(result.current.hiddenCountByCollapser.get(a.id)).toBe(2); // B + C now hidden
    expect(result.current.visibleEntityIds.has(c.id)).toBe(false);
  });
});
