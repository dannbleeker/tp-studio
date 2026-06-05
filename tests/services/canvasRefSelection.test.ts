// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getHoveredJunctor,
  getSelectionViewportRect,
  setCanvasInstance,
  setHoveredJunctor,
} from '@/services/canvasRef';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../helpers/seedDoc';

// Only the DOM-reading + junctor/selection paths of canvasRef (the registry basics
// live in canvasRef.test.ts). getSelectionViewportRect reads the store selection +
// unions the selected nodes' DOM rects, so this file runs in jsdom with stubbed rects.
type Flow = Parameters<typeof setCanvasInstance>[0];
const mockFlow = (): Flow => ({ getNodes: () => [], getEdges: () => [] }) as unknown as Flow;

const placeNode = (id: string, x: number, y: number, w: number, h: number) => {
  const el = document.createElement('div');
  el.className = 'react-flow__node';
  el.setAttribute('data-id', id);
  el.getBoundingClientRect = () => new DOMRect(x, y, w, h);
  document.body.appendChild(el);
};

beforeEach(() => {
  resetStoreForTest();
  setCanvasInstance(null);
  setHoveredJunctor(null);
  document.body.innerHTML = '';
});
afterEach(() => {
  setCanvasInstance(null);
  setHoveredJunctor(null);
});

describe('hovered junctor registry', () => {
  it('sets, gets, and clears the hovered junctor', () => {
    expect(getHoveredJunctor()).toBeNull();
    setHoveredJunctor({ groupId: 'g1', kind: 'AND' });
    expect(getHoveredJunctor()).toEqual({ groupId: 'g1', kind: 'AND' });
    setHoveredJunctor(null);
    expect(getHoveredJunctor()).toBeNull();
  });
});

describe('getSelectionViewportRect', () => {
  it('returns null without an instance, and when nothing is selected', () => {
    expect(getSelectionViewportRect()).toBeNull();
    setCanvasInstance(mockFlow());
    expect(getSelectionViewportRect()).toBeNull();
  });

  it('returns null when the selected entities are not in the DOM', () => {
    setCanvasInstance(mockFlow());
    const a = seedEntity('A');
    useDocumentStore.getState().selectEntities([a.id]);
    expect(getSelectionViewportRect()).toBeNull();
  });

  it('unions the rects of selected entity DOM nodes', () => {
    setCanvasInstance(mockFlow());
    const a = seedEntity('A');
    const b = seedEntity('B');
    useDocumentStore.getState().selectEntities([a.id, b.id]);
    placeNode(a.id, 10, 20, 100, 40); // right 110, bottom 60
    placeNode(b.id, 200, 5, 50, 80); // right 250, bottom 85
    const r = getSelectionViewportRect();
    expect(r).not.toBeNull();
    expect([r?.left, r?.top, r?.right, r?.bottom]).toEqual([10, 5, 250, 85]);
  });

  it('resolves an edge selection to its endpoint rects', () => {
    setCanvasInstance(mockFlow());
    const a = seedEntity('A');
    const b = seedEntity('B');
    const edge = useDocumentStore.getState().connect(a.id, b.id);
    if (!edge) throw new Error('edge not created');
    useDocumentStore.getState().selectEdge(edge.id);
    placeNode(a.id, 0, 0, 10, 10);
    placeNode(b.id, 50, 50, 10, 10);
    const r = getSelectionViewportRect();
    expect([r?.left, r?.top, r?.right, r?.bottom]).toEqual([0, 0, 60, 60]);
  });

  it('resolves a group selection to the group node rect', () => {
    setCanvasInstance(mockFlow());
    useDocumentStore.getState().selectGroup('g1');
    placeNode('g1', 5, 5, 20, 20);
    const r = getSelectionViewportRect();
    expect([r?.left, r?.top, r?.right, r?.bottom]).toEqual([5, 5, 25, 25]);
  });
});
