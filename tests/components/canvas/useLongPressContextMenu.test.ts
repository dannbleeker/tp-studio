import { renderHook } from '@testing-library/react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLongPressContextMenu } from '@/components/canvas/hooks/useLongPressContextMenu';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../../helpers/seedDoc';

beforeEach(() => {
  resetStoreForTest();
  localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const s = () => useDocumentStore.getState();
const handlers = () => renderHook(() => useLongPressContextMenu()).result.current;

// A pointer event stub carrying only the fields the hook reads.
const ptr = (over: Partial<ReactPointerEvent>): ReactPointerEvent =>
  ({
    pointerType: 'touch',
    clientX: 100,
    clientY: 200,
    pointerId: 1,
    ...over,
  }) as ReactPointerEvent;

// Point `document.elementFromPoint` at an element whose `.closest()` resolves to
// a node / edge with the given id, or to the bare pane when both are null.
function pointAt(target: { node?: string; edge?: string }) {
  const el = {
    closest: (sel: string) => {
      if (sel === '.react-flow__node' && target.node) return { dataset: { id: target.node } };
      if (sel === '.react-flow__edge' && target.edge) return { dataset: { id: target.edge } };
      return null;
    },
  } as unknown as Element;
  // jsdom doesn't implement `elementFromPoint`; install a controllable stub.
  document.elementFromPoint = () => el;
}

describe('useLongPressContextMenu', () => {
  it('opens the entity menu after a stationary touch hold', () => {
    const a = seedEntity('A');
    pointAt({ node: a.id });
    const h = handlers();
    h.onPointerDown(ptr({ clientX: 120, clientY: 240 }));
    // Nothing yet — the hold hasn't elapsed.
    expect(s().contextMenu.open).toBe(false);
    vi.advanceTimersByTime(500);
    expect(s().selection).toEqual({ kind: 'entities', ids: [a.id] });
    expect(s().contextMenu).toMatchObject({
      open: true,
      target: { kind: 'entity', id: a.id },
      x: 120,
      y: 240,
    });
  });

  it('opens the edge menu when the press lands on an edge', () => {
    pointAt({ edge: 'e1' });
    handlers().onPointerDown(ptr({}));
    vi.advanceTimersByTime(500);
    expect(s().contextMenu).toMatchObject({ open: true, target: { kind: 'edge', id: 'e1' } });
  });

  it('opens the pane menu on empty canvas', () => {
    pointAt({});
    handlers().onPointerDown(ptr({}));
    vi.advanceTimersByTime(500);
    expect(s().contextMenu).toMatchObject({ open: true, target: { kind: 'pane' } });
  });

  it('ignores mouse presses (the native right-click path handles those)', () => {
    pointAt({});
    handlers().onPointerDown(ptr({ pointerType: 'mouse' }));
    vi.advanceTimersByTime(500);
    expect(s().contextMenu.open).toBe(false);
  });

  it('cancels when the finger moves past the threshold (a pan / connection drag)', () => {
    pointAt({});
    const h = handlers();
    h.onPointerDown(ptr({ clientX: 100, clientY: 200 }));
    h.onPointerMove(ptr({ clientX: 100, clientY: 220 })); // 20px > 12px threshold
    vi.advanceTimersByTime(500);
    expect(s().contextMenu.open).toBe(false);
  });

  it('does not fire if the press is released before the hold elapses', () => {
    pointAt({});
    const h = handlers();
    h.onPointerDown(ptr({}));
    vi.advanceTimersByTime(300);
    h.onPointerUp();
    vi.advanceTimersByTime(300);
    expect(s().contextMenu.open).toBe(false);
  });

  it('swallows the trailing click after a long-press so the menu is not immediately closed', () => {
    pointAt({});
    const h = handlers();
    h.onPointerDown(ptr({}));
    vi.advanceTimersByTime(500);
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();
    h.onClickCapture({ preventDefault, stopPropagation } as unknown as React.MouseEvent);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(stopPropagation).toHaveBeenCalledOnce();
  });
});
