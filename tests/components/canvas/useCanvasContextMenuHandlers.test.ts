import { renderHook } from '@testing-library/react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AnyTPNode, TPEdge } from '@/components/canvas/edges/flow-types';
import { useCanvasContextMenuHandlers } from '@/components/canvas/hooks/useCanvasContextMenuHandlers';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedConnectedPair, seedEntity } from '../../helpers/seedDoc';

beforeEach(() => {
  resetStoreForTest();
  localStorage.clear();
});

const s = () => useDocumentStore.getState();
const evt = (x = 0, y = 0) =>
  ({ preventDefault: () => {}, clientX: x, clientY: y }) as unknown as ReactMouseEvent;
const nodeArg = (id: string) => ({ id }) as unknown as AnyTPNode;
const edgeArg = (id: string) => ({ id }) as unknown as TPEdge;
const handlers = () => renderHook(() => useCanvasContextMenuHandlers()).result.current;

describe('useCanvasContextMenuHandlers — onNodeContextMenu', () => {
  it('selects the entity and opens the entity menu at the cursor', () => {
    const a = seedEntity('A');
    handlers().onNodeContextMenu(evt(120, 240), nodeArg(a.id));
    expect(s().selection).toEqual({ kind: 'entities', ids: [a.id] });
    expect(s().contextMenu).toEqual({
      open: true,
      target: { kind: 'entity', id: a.id },
      x: 120,
      y: 240,
    });
  });

  it('keeps an existing multi-selection that already includes the entity', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    s().selectEntities([a.id, b.id]);
    handlers().onNodeContextMenu(evt(), nodeArg(a.id));
    expect(s().selection).toEqual({ kind: 'entities', ids: [a.id, b.id] }); // unchanged
    expect(s().contextMenu).toMatchObject({ open: true, target: { kind: 'entity', id: a.id } });
  });
});

describe('useCanvasContextMenuHandlers — onEdgeContextMenu', () => {
  it('selects the edge and opens the edge menu', () => {
    const { edge } = seedConnectedPair();
    handlers().onEdgeContextMenu(evt(10, 20), edgeArg(edge.id));
    expect(s().selection).toEqual({ kind: 'edges', ids: [edge.id] });
    expect(s().contextMenu).toMatchObject({ open: true, target: { kind: 'edge', id: edge.id } });
  });
});

describe('useCanvasContextMenuHandlers — onPaneContextMenu', () => {
  it('opens the pane menu without changing the selection', () => {
    const a = seedEntity('A');
    s().selectEntity(a.id);
    handlers().onPaneContextMenu(evt(5, 6));
    expect(s().selection).toEqual({ kind: 'entities', ids: [a.id] }); // unchanged
    expect(s().contextMenu).toMatchObject({ open: true, target: { kind: 'pane' } });
  });
});
