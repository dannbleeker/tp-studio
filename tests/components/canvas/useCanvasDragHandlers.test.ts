import { renderHook } from '@testing-library/react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AnyTPNode } from '@/components/canvas/edges/flow-types';
import { useCanvasDragHandlers } from '@/components/canvas/hooks/useCanvasDragHandlers';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../../helpers/seedDoc';

beforeEach(() => {
  resetStoreForTest();
  localStorage.clear();
});

const s = () => useDocumentStore.getState();
const evt = (altKey = false) => ({ altKey }) as unknown as ReactMouseEvent;
const rfNode = (id: string, x: number, y: number): AnyTPNode =>
  ({ id, position: { x, y }, measured: { width: 200, height: 60 } }) as unknown as AnyTPNode;
const edgeCount = () => Object.keys(s().doc.edges).length;

// Stack A at (0,0) and B at (0,200) so the A→B edge runs vertically through
// x=100 (the node centre); a node dropped at (0,100) lands on that centerline.
const seedStackedPairPlusFloater = () => {
  const a = seedEntity('A');
  const b = seedEntity('B');
  const c = seedEntity('C');
  const edge = s().connect(a.id, b.id);
  const nodes = [rfNode(a.id, 0, 0), rfNode(b.id, 0, 200), rfNode(c.id, 0, 100)];
  return { a, b, c, edge, nodes };
};

describe('useCanvasDragHandlers — onNodeDrag (splice highlight)', () => {
  it('Alt-dragging near an edge centerline sets the splice-target highlight', () => {
    const { c, edge, nodes } = seedStackedPairPlusFloater();
    const { result } = renderHook(() => useCanvasDragHandlers(s().doc, nodes));
    result.current.onNodeDrag(evt(true), rfNode(c.id, 0, 100));
    expect(s().spliceTargetEdgeId).toBe(edge?.id ?? null);
  });

  it('clears the highlight on a non-Alt drag', () => {
    const { c, nodes } = seedStackedPairPlusFloater();
    s().setSpliceTargetEdge('stale');
    const { result } = renderHook(() => useCanvasDragHandlers(s().doc, nodes));
    result.current.onNodeDrag(evt(false), rfNode(c.id, 0, 100));
    expect(s().spliceTargetEdgeId).toBeNull();
  });
});

describe('useCanvasDragHandlers — onNodeDragStop (splice apply)', () => {
  it('Alt-dropping a node on an edge centerline splices it into that edge', () => {
    const { a, b, c, nodes } = seedStackedPairPlusFloater();
    const { result } = renderHook(() => useCanvasDragHandlers(s().doc, nodes));
    result.current.onNodeDragStop(evt(true), rfNode(c.id, 0, 100));
    const edges = Object.values(s().doc.edges);
    expect(edges.some((e) => e.sourceId === a.id && e.targetId === c.id)).toBe(true);
    expect(edges.some((e) => e.sourceId === c.id && e.targetId === b.id)).toBe(true);
    expect(edges.some((e) => e.sourceId === a.id && e.targetId === b.id)).toBe(false);
    expect(s().spliceTargetEdgeId).toBeNull();
  });

  it('does nothing on a non-Alt drop (left to React Flow position persist)', () => {
    const { c, nodes } = seedStackedPairPlusFloater();
    const before = edgeCount();
    const { result } = renderHook(() => useCanvasDragHandlers(s().doc, nodes));
    result.current.onNodeDragStop(evt(false), rfNode(c.id, 0, 100));
    expect(edgeCount()).toBe(before);
  });

  it('does nothing when the drop is nowhere near an edge', () => {
    const { c, nodes } = seedStackedPairPlusFloater();
    const before = edgeCount();
    const { result } = renderHook(() => useCanvasDragHandlers(s().doc, nodes));
    result.current.onNodeDragStop(evt(true), rfNode(c.id, 5000, 100));
    expect(edgeCount()).toBe(before);
  });
});
