import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AnyTPNode, TPEdge } from '@/components/canvas/edges/flow-types';
import { useSearchDimming } from '@/components/canvas/hooks/useSearchDimming';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../../helpers/seedDoc';

beforeEach(() => {
  resetStoreForTest();
  localStorage.clear();
});

const node = (id: string): AnyTPNode =>
  ({ id, type: 'tp', position: { x: 0, y: 0 }, data: {} }) as unknown as AnyTPNode;
const edge = (id: string, source: string, target: string): TPEdge =>
  ({ id, source, target, type: 'tp', data: {} }) as unknown as TPEdge;

const s = () => useDocumentStore.getState();

describe('useSearchDimming', () => {
  it('returns the input arrays untouched (same ref) when search is closed', () => {
    const a = seedEntity('Apple');
    const nodes = [node(a.id)];
    const { result } = renderHook(() => useSearchDimming(s().doc, nodes, []));
    expect(result.current.nodes).toBe(nodes); // referential identity → RF cache stays warm
  });

  it('does not dim when the query is empty', () => {
    const a = seedEntity('Apple');
    s().openSearch();
    s().setSearchQuery('');
    const nodes = [node(a.id)];
    const { result } = renderHook(() => useSearchDimming(s().doc, nodes, []));
    expect(result.current.nodes).toBe(nodes);
  });

  it('dims non-matching nodes when a query has matches', () => {
    const apple = seedEntity('Apple');
    const banana = seedEntity('Banana');
    s().openSearch();
    s().setSearchQuery('Apple');
    const nodes = [node(apple.id), node(banana.id)];
    const { result } = renderHook(() => useSearchDimming(s().doc, nodes, []));
    expect(result.current.nodes.find((n) => n.id === banana.id)?.className).toContain('tp-dimmed');
    expect(result.current.nodes.find((n) => n.id === apple.id)?.className ?? '').not.toContain(
      'tp-dimmed'
    );
  });

  it('keeps an edge between two matched endpoints full-strength, dims one touching a non-match', () => {
    const apple = seedEntity('Apple');
    const apricot = seedEntity('Apricot');
    const banana = seedEntity('Banana');
    s().openSearch();
    s().setSearchQuery('Ap'); // matches Apple + Apricot, not Banana
    const { result } = renderHook(() =>
      useSearchDimming(
        s().doc,
        [],
        [edge('between', apple.id, apricot.id), edge('toNonMatch', apple.id, banana.id)]
      )
    );
    expect(result.current.edges.find((e) => e.id === 'between')?.className ?? '').not.toContain(
      'tp-dimmed'
    );
    expect(result.current.edges.find((e) => e.id === 'toNonMatch')?.className).toContain(
      'tp-dimmed'
    );
  });
});
