import { renderHook } from '@testing-library/react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AnyTPNode, TPEdge } from '@/components/canvas/edges/flow-types';
import { useCanvasClickHandlers } from '@/components/canvas/hooks/useCanvasClickHandlers';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedConnectedPair, seedEntity } from '../../helpers/seedDoc';

beforeEach(() => {
  resetStoreForTest();
  localStorage.clear();
});

const s = () => useDocumentStore.getState();
const evt = (altKey = false) =>
  ({ altKey, stopPropagation: () => {} }) as unknown as ReactMouseEvent;
const nodeArg = (id: string) => ({ id }) as unknown as AnyTPNode;
const edgeArg = (id: string) => ({ id }) as unknown as TPEdge;
const handlers = () => renderHook(() => useCanvasClickHandlers()).result.current;
const edgeCount = () => Object.keys(s().doc.edges).length;

describe('useCanvasClickHandlers — onNodeClick', () => {
  it('Alt+click creates an edge from the single selected source to the clicked node', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    s().selectEntity(a.id);
    handlers().onNodeClick(evt(true), nodeArg(b.id));
    expect(
      Object.values(s().doc.edges).some((e) => e.sourceId === a.id && e.targetId === b.id)
    ).toBe(true);
  });

  it('does nothing without the Alt modifier', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    s().selectEntity(a.id);
    const before = edgeCount();
    handlers().onNodeClick(evt(false), nodeArg(b.id));
    expect(edgeCount()).toBe(before);
  });

  it('does nothing when nothing is selected', () => {
    const b = seedEntity('B');
    const before = edgeCount();
    handlers().onNodeClick(evt(true), nodeArg(b.id));
    expect(edgeCount()).toBe(before);
  });

  it('does nothing when Alt+clicking the already-selected node (no self-loop)', () => {
    const a = seedEntity('A');
    s().selectEntity(a.id);
    const before = edgeCount();
    handlers().onNodeClick(evt(true), nodeArg(a.id));
    expect(edgeCount()).toBe(before);
  });
});

describe('useCanvasClickHandlers — onEdgeClick', () => {
  it('clicking the held source edge again cancels join mode', () => {
    const { edge } = seedConnectedPair();
    s().startEdgeJoinMode(edge.id);
    handlers().onEdgeClick(evt(), edgeArg(edge.id));
    expect(s().canvasMode.kind).toBe('idle');
    expect(s().toasts.some((t) => /cancelled/i.test(t.message))).toBe(true);
  });

  it('does nothing when not in join mode', () => {
    const { edge } = seedConnectedPair();
    handlers().onEdgeClick(evt(), edgeArg(edge.id));
    expect(s().canvasMode.kind).toBe('idle');
    expect(s().toasts.length).toBe(0);
  });

  it('clicking a second edge exits join mode (group attempt resolved either way)', () => {
    const { edge: e1 } = seedConnectedPair();
    const c = seedEntity('C');
    const e2 = s().connect(e1.targetId, c.id);
    s().startEdgeJoinMode(e1.id);
    handlers().onEdgeClick(evt(), edgeArg(e2?.id ?? 'missing'));
    expect(s().canvasMode.kind).toBe('idle');
  });
});

describe('useCanvasClickHandlers — onPaneClick', () => {
  it('clears the selection', () => {
    const a = seedEntity('A');
    s().selectEntity(a.id);
    expect(s().selection.kind).toBe('entities');
    handlers().onPaneClick();
    expect(s().selection.kind).toBe('none');
  });

  it('also exits edge-join mode', () => {
    const { edge } = seedConnectedPair();
    s().startEdgeJoinMode(edge.id);
    handlers().onPaneClick();
    expect(s().canvasMode.kind).toBe('idle');
  });
});
