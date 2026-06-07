import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  findNeighborInDirection,
  useArrowKeyNodeNav,
} from '@/components/canvas/hooks/useArrowKeyNodeNav';
import type { TPDocument } from '@/domain/types';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { makeDoc, makeEdge, makeEntity, resetIds } from '../../domain/helpers';
import { seedConnectedPair, seedEntity } from '../../helpers/seedDoc';

// ---------------------------------------------------------------------------
// Mock @xyflow/react so useArrowKeyNodeNav's `useReactFlow()` call returns a
// controlled FlowLookup. The mock is module-level so vi.hoisted can capture
// the mutable reference that individual tests override per-case.
// ---------------------------------------------------------------------------
const { mockFlowRef } = vi.hoisted(() => ({
  mockFlowRef: {
    current: {
      setNodes: vi.fn(),
      getInternalNode: (_id: string) =>
        undefined as
          | {
              internals: { positionAbsolute: { x: number; y: number } };
              measured?: { width?: number; height?: number };
            }
          | undefined,
    },
  },
}));

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  return {
    ...actual,
    useReactFlow: () => mockFlowRef.current,
  };
});

/**
 * Session 135 — canvas a11y slice 4. The scoring rules driving arrow-key
 * navigation between connected nodes; the hook wiring (DOM focus, RF
 * setNodes) is exercised end-to-end via e2e + the manual checklist.
 *
 * Coordinate frame matches the post-layout absolute positions React Flow
 * hands us through `getInternalNode(id).internals.positionAbsolute`:
 *   - x grows right
 *   - y grows DOWN (so "up" is dy < 0)
 *
 * The mock flow returns `positionAbsolute` + a measured size; the helper
 * derives each node's center from those.
 */

type FakeNode = { x: number; y: number; w?: number; h?: number };

// `findNeighborInDirection` takes a `FlowLookup` — the minimal structural
// type around `getInternalNode` — so the mock satisfies it directly. The
// real `useReactFlow()` return is a strict superset.
const mockFlow = (positions: Record<string, FakeNode>) => ({
  getInternalNode: (id: string) => {
    const p = positions[id];
    if (!p) return undefined;
    return {
      internals: { positionAbsolute: { x: p.x, y: p.y } },
      measured: { width: p.w ?? 220, height: p.h ?? 72 },
    };
  },
});

/** Build a fan-of-4 around a centre entity, each at a cardinal direction. */
const buildFanDoc = () => {
  resetIds();
  const c = makeEntity({ title: 'center' });
  const u = makeEntity({ title: 'up' });
  const d = makeEntity({ title: 'down' });
  const l = makeEntity({ title: 'left' });
  const r = makeEntity({ title: 'right' });
  const doc = makeDoc(
    [c, u, d, l, r],
    [makeEdge(c.id, u.id), makeEdge(c.id, d.id), makeEdge(c.id, l.id), makeEdge(c.id, r.id)]
  );
  const flow = mockFlow({
    [c.id]: { x: 0, y: 0 },
    [u.id]: { x: 0, y: -200 },
    [d.id]: { x: 0, y: 200 },
    [l.id]: { x: -300, y: 0 },
    [r.id]: { x: 300, y: 0 },
  });
  return { doc, flow, c, u, d, l, r };
};

describe('findNeighborInDirection — cardinal cases', () => {
  it('picks the up neighbour for ArrowUp', () => {
    const { doc, flow, c, u } = buildFanDoc();
    expect(findNeighborInDirection(c.id, 'up', doc, flow)).toBe(u.id);
  });
  it('picks the down neighbour for ArrowDown', () => {
    const { doc, flow, c, d } = buildFanDoc();
    expect(findNeighborInDirection(c.id, 'down', doc, flow)).toBe(d.id);
  });
  it('picks the left neighbour for ArrowLeft', () => {
    const { doc, flow, c, l } = buildFanDoc();
    expect(findNeighborInDirection(c.id, 'left', doc, flow)).toBe(l.id);
  });
  it('picks the right neighbour for ArrowRight', () => {
    const { doc, flow, c, r } = buildFanDoc();
    expect(findNeighborInDirection(c.id, 'right', doc, flow)).toBe(r.id);
  });
});

describe('findNeighborInDirection — selection rules', () => {
  it('returns null when no connected neighbour qualifies', () => {
    resetIds();
    const a = makeEntity();
    const b = makeEntity();
    const doc = makeDoc([a, b], [makeEdge(a.id, b.id)]);
    const flow = mockFlow({
      [a.id]: { x: 0, y: 0 },
      [b.id]: { x: 0, y: 200 }, // b is below
    });
    // From a, "up" → no connected neighbour above → null.
    expect(findNeighborInDirection(a.id, 'up', doc, flow)).toBe(null);
  });

  it('walks BOTH incoming and outgoing edges as candidates', () => {
    resetIds();
    const a = makeEntity({ title: 'a' });
    const b = makeEntity({ title: 'b' });
    // Edge from b -> a; a has only an incoming edge, no outgoing.
    const doc = makeDoc([a, b], [makeEdge(b.id, a.id)]);
    const flow = mockFlow({
      [a.id]: { x: 0, y: 0 },
      [b.id]: { x: -300, y: 0 },
    });
    // From a, ArrowLeft must still find b (the source of the incoming edge).
    expect(findNeighborInDirection(a.id, 'left', doc, flow)).toBe(b.id);
  });

  it('ignores unconnected nodes even if they sit in the direction', () => {
    resetIds();
    const a = makeEntity();
    const b = makeEntity();
    const stranger = makeEntity({ title: 'stranger' });
    // Only a-b connected; stranger sits between them but no edge.
    const doc: TPDocument = makeDoc([a, b, stranger], [makeEdge(a.id, b.id)]);
    const flow = mockFlow({
      [a.id]: { x: 0, y: 0 },
      [stranger.id]: { x: 150, y: 0 },
      [b.id]: { x: 300, y: 0 },
    });
    // Stranger is geometrically closer to the right, but unconnected.
    // We must skip stranger and return b.
    expect(findNeighborInDirection(a.id, 'right', doc, flow)).toBe(b.id);
  });

  it('skips back-edges + mutex edges (non-causal)', () => {
    resetIds();
    const a = makeEntity();
    const b = makeEntity();
    const doc = makeDoc([a, b], [makeEdge(a.id, b.id, { isBackEdge: true })]);
    const flow = mockFlow({
      [a.id]: { x: 0, y: 0 },
      [b.id]: { x: 300, y: 0 },
    });
    expect(findNeighborInDirection(a.id, 'right', doc, flow)).toBe(null);
  });

  it('prefers the closer neighbour when two are in the same direction', () => {
    resetIds();
    const a = makeEntity();
    const near = makeEntity({ title: 'near' });
    const far = makeEntity({ title: 'far' });
    const doc = makeDoc([a, near, far], [makeEdge(a.id, near.id), makeEdge(a.id, far.id)]);
    const flow = mockFlow({
      [a.id]: { x: 0, y: 0 },
      [near.id]: { x: 200, y: 0 },
      [far.id]: { x: 500, y: 0 },
    });
    expect(findNeighborInDirection(a.id, 'right', doc, flow)).toBe(near.id);
  });

  it('drops candidates whose perpendicular delta exceeds the primary axis', () => {
    resetIds();
    const a = makeEntity();
    const b = makeEntity({ title: 'mostly-right' });
    // b is far more to the right than up — ArrowUp should reject it.
    const doc = makeDoc([a, b], [makeEdge(a.id, b.id)]);
    const flow = mockFlow({
      [a.id]: { x: 0, y: 0 },
      [b.id]: { x: 400, y: -50 },
    });
    expect(findNeighborInDirection(a.id, 'up', doc, flow)).toBe(null);
  });

  it('returns null when the focused node has no known position', () => {
    resetIds();
    const a = makeEntity();
    const b = makeEntity();
    const doc = makeDoc([a, b], [makeEdge(a.id, b.id)]);
    const flow = mockFlow({
      [b.id]: { x: 0, y: -200 }, // 'a' missing from the layout
    });
    expect(findNeighborInDirection(a.id, 'up', doc, flow)).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// useArrowKeyNodeNav — hook-level tests
//
// These tests exercise the full event-handler path: keydown on window →
// guard checks → findNeighborInDirection → store.selectEntity + RF setNodes.
//
// Setup helpers:
//   - `makeFocusedNode(id)` — injects a real DOM node with the
//     `.react-flow__node` class and `data-id`, then focuses it so
//     `document.activeElement` points there.
//   - `makeFlow(positions)` — builds a FlowLookup that returns absolute
//     positions + measured sizes, assigned into `mockFlowRef.current`.
// ---------------------------------------------------------------------------

/** Create a DOM element that looks like a React Flow node wrapper and focus it. */
const makeFocusedNode = (id: string): HTMLDivElement => {
  const el = document.createElement('div');
  el.className = 'react-flow__node';
  el.setAttribute('data-id', id);
  el.setAttribute('tabindex', '0');
  document.body.appendChild(el);
  el.focus();
  return el;
};

/** Build a positions map into the module-level mock so the hook picks it up. */
const makeFlow = (positions: Record<string, FakeNode>) => {
  mockFlowRef.current = {
    setNodes: vi.fn(),
    getInternalNode: (id: string) => {
      const p = positions[id];
      if (!p) return undefined;
      return {
        internals: { positionAbsolute: { x: p.x, y: p.y } },
        measured: { width: p.w ?? 220, height: p.h ?? 72 },
      };
    },
  };
};

beforeEach(() => {
  resetStoreForTest();
  // Reset the mock to a clean state without position data.
  mockFlowRef.current = {
    setNodes: vi.fn(),
    getInternalNode: () => undefined,
  };
});

afterEach(() => {
  // Remove any DOM nodes appended by makeFocusedNode.
  document.body.innerHTML = '';
  cleanup();
});

const fireKey = (key: string, init: KeyboardEventInit = {}) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
  });

describe('useArrowKeyNodeNav — guard: ignores non-arrow keys', () => {
  it('does not change selection when a non-arrow key is pressed', () => {
    const { a } = seedConnectedPair('A', 'B');
    useDocumentStore.getState().selectEntity(a.id);
    const selBefore = useDocumentStore.getState().selection;
    renderHook(() => useArrowKeyNodeNav());
    fireKey('Enter');
    expect(useDocumentStore.getState().selection).toEqual(selBefore);
  });
});

describe('useArrowKeyNodeNav — guard: ignores modifier-arrow combos', () => {
  it('passes through Shift+ArrowRight without changing selection', () => {
    const { a } = seedConnectedPair('A', 'B');
    useDocumentStore.getState().selectEntity(a.id);
    makeFocusedNode(a.id);
    renderHook(() => useArrowKeyNodeNav());
    const selBefore = useDocumentStore.getState().selection;
    fireKey('ArrowRight', { shiftKey: true });
    expect(useDocumentStore.getState().selection).toEqual(selBefore);
  });

  it('passes through Ctrl+ArrowLeft without changing selection', () => {
    const { a } = seedConnectedPair('A', 'B');
    useDocumentStore.getState().selectEntity(a.id);
    makeFocusedNode(a.id);
    renderHook(() => useArrowKeyNodeNav());
    const selBefore = useDocumentStore.getState().selection;
    fireKey('ArrowLeft', { ctrlKey: true });
    expect(useDocumentStore.getState().selection).toEqual(selBefore);
  });
});

describe('useArrowKeyNodeNav — guard: active element not a node wrapper', () => {
  it('does nothing when focus is on a plain div (no react-flow__node class)', () => {
    const { a } = seedConnectedPair('A', 'B');
    useDocumentStore.getState().selectEntity(a.id);
    // focus a regular div, not a node wrapper
    const plain = document.createElement('div');
    plain.setAttribute('tabindex', '0');
    document.body.appendChild(plain);
    plain.focus();
    renderHook(() => useArrowKeyNodeNav());
    const selBefore = useDocumentStore.getState().selection;
    fireKey('ArrowUp');
    expect(useDocumentStore.getState().selection).toEqual(selBefore);
  });

  it('does nothing when focus is inside a text input (typing guard)', () => {
    const { a } = seedConnectedPair('A', 'B');
    useDocumentStore.getState().selectEntity(a.id);
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    renderHook(() => useArrowKeyNodeNav());
    const selBefore = useDocumentStore.getState().selection;
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    });
    expect(useDocumentStore.getState().selection).toEqual(selBefore);
  });

  it('does nothing when a node element has no data-id attribute', () => {
    const el = document.createElement('div');
    el.className = 'react-flow__node';
    el.setAttribute('tabindex', '0');
    // intentionally no data-id
    document.body.appendChild(el);
    el.focus();
    renderHook(() => useArrowKeyNodeNav());
    const selBefore = useDocumentStore.getState().selection;
    fireKey('ArrowUp');
    expect(useDocumentStore.getState().selection).toEqual(selBefore);
  });
});

describe('useArrowKeyNodeNav — guard: no qualified neighbour', () => {
  it('is a no-op when there is no connected neighbour in the pressed direction', () => {
    const { a, b } = seedConnectedPair('A', 'B');
    // a → b; b is to the right.  ArrowUp has no upward neighbour from a.
    makeFlow({ [a.id]: { x: 0, y: 0 }, [b.id]: { x: 300, y: 0 } });
    makeFocusedNode(a.id);
    useDocumentStore.getState().selectEntity(a.id);
    renderHook(() => useArrowKeyNodeNav());
    fireKey('ArrowUp');
    const sel = useDocumentStore.getState().selection;
    expect(sel.kind).toBe('entities');
    if (sel.kind === 'entities') expect(sel.ids).toEqual([a.id]);
  });
});

describe('useArrowKeyNodeNav — happy path: navigation in all four directions', () => {
  /**
   * Seed a cross-shaped graph in the store (center + 4 cardinal neighbours),
   * position them with the mock flow, focus the center node, fire a key, and
   * assert the selection moved to the correct neighbour.
   */
  const buildCross = () => {
    const center = seedEntity('center');
    const up = seedEntity('up');
    const down = seedEntity('down');
    const left = seedEntity('left');
    const right = seedEntity('right');
    const s = useDocumentStore.getState();
    s.connect(center.id, up.id);
    s.connect(center.id, down.id);
    s.connect(center.id, left.id);
    s.connect(center.id, right.id);

    // Position: center at origin; neighbours at 300 px in each direction.
    // Use default 220 x 72 nodes so centers are at (pos.x+110, pos.y+36).
    makeFlow({
      [center.id]: { x: 0, y: 0 },
      [up.id]: { x: 0, y: -200 },
      [down.id]: { x: 0, y: 200 },
      [left.id]: { x: -300, y: 0 },
      [right.id]: { x: 300, y: 0 },
    });

    return { center, up, down, left, right };
  };

  it('ArrowUp moves selection to the node above', () => {
    const { center, up } = buildCross();
    useDocumentStore.getState().selectEntity(center.id);
    makeFocusedNode(center.id);
    renderHook(() => useArrowKeyNodeNav());
    fireKey('ArrowUp');
    const sel = useDocumentStore.getState().selection;
    expect(sel.kind).toBe('entities');
    if (sel.kind === 'entities') expect(sel.ids).toEqual([up.id]);
  });

  it('ArrowDown moves selection to the node below', () => {
    const { center, down } = buildCross();
    useDocumentStore.getState().selectEntity(center.id);
    makeFocusedNode(center.id);
    renderHook(() => useArrowKeyNodeNav());
    fireKey('ArrowDown');
    const sel = useDocumentStore.getState().selection;
    expect(sel.kind).toBe('entities');
    if (sel.kind === 'entities') expect(sel.ids).toEqual([down.id]);
  });

  it('ArrowLeft moves selection to the node to the left', () => {
    const { center, left } = buildCross();
    useDocumentStore.getState().selectEntity(center.id);
    makeFocusedNode(center.id);
    renderHook(() => useArrowKeyNodeNav());
    fireKey('ArrowLeft');
    const sel = useDocumentStore.getState().selection;
    expect(sel.kind).toBe('entities');
    if (sel.kind === 'entities') expect(sel.ids).toEqual([left.id]);
  });

  it('ArrowRight moves selection to the node to the right', () => {
    const { center, right } = buildCross();
    useDocumentStore.getState().selectEntity(center.id);
    makeFocusedNode(center.id);
    renderHook(() => useArrowKeyNodeNav());
    fireKey('ArrowRight');
    const sel = useDocumentStore.getState().selection;
    expect(sel.kind).toBe('entities');
    if (sel.kind === 'entities') expect(sel.ids).toEqual([right.id]);
  });

  it('calls flow.setNodes to mirror the selection into React Flow', () => {
    const { center } = buildCross();
    useDocumentStore.getState().selectEntity(center.id);
    makeFocusedNode(center.id);
    renderHook(() => useArrowKeyNodeNav());
    fireKey('ArrowUp');
    expect(mockFlowRef.current.setNodes).toHaveBeenCalled();
  });

  it('moves DOM focus to the target node element', () => {
    const { center, right } = buildCross();
    useDocumentStore.getState().selectEntity(center.id);
    makeFocusedNode(center.id);
    // Pre-create the target node element so the focus() call finds it.
    const targetEl = makeFocusedNode(right.id);
    // Refocus center so center is active before key press.
    const centerEl = document.querySelector(
      `.react-flow__node[data-id="${center.id}"]`
    ) as HTMLElement;
    centerEl.focus();
    renderHook(() => useArrowKeyNodeNav());
    fireKey('ArrowRight');
    expect(document.activeElement).toBe(targetEl);
  });
});

describe('useArrowKeyNodeNav — tie-break: closer node wins', () => {
  it('picks the closer of two nodes in the same direction', () => {
    const center = seedEntity('center');
    const near = seedEntity('near');
    const far = seedEntity('far');
    const s = useDocumentStore.getState();
    s.connect(center.id, near.id);
    s.connect(center.id, far.id);
    makeFlow({
      [center.id]: { x: 0, y: 0 },
      [near.id]: { x: 0, y: -150 },
      [far.id]: { x: 0, y: -400 },
    });
    useDocumentStore.getState().selectEntity(center.id);
    makeFocusedNode(center.id);
    renderHook(() => useArrowKeyNodeNav());
    fireKey('ArrowUp');
    const sel = useDocumentStore.getState().selection;
    expect(sel.kind).toBe('entities');
    if (sel.kind === 'entities') expect(sel.ids).toEqual([near.id]);
  });
});

describe('useArrowKeyNodeNav — hook cleanup', () => {
  it('removes the event listener on unmount (no selection after unmount)', () => {
    const { a, b } = seedConnectedPair('A', 'B');
    makeFlow({ [a.id]: { x: 0, y: 0 }, [b.id]: { x: 0, y: -200 } });
    makeFocusedNode(a.id);
    useDocumentStore.getState().selectEntity(a.id);
    const { unmount } = renderHook(() => useArrowKeyNodeNav());
    unmount();
    // After unmount the listener is gone; key should have no effect.
    fireKey('ArrowUp');
    const sel = useDocumentStore.getState().selection;
    // Still on a.id — no navigation happened after unmount.
    expect(sel.kind).toBe('entities');
    if (sel.kind === 'entities') expect(sel.ids).toEqual([a.id]);
  });
});
