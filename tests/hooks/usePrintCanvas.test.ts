/**
 * `usePrintCanvas` — the browser-print framing hook (Session 178).
 *
 * On `beforeprint` it must: remember the user's viewport, frame the whole
 * diagram into the fixed print box (centring the diagram's bounds), flag
 * `body.printing`, and hide the MiniMap. On `afterprint` it must put
 * everything back. An empty canvas is a no-op, and the listeners unbind on
 * unmount.
 *
 * The print box geometry below (648 × 760, 0.92 padding) mirrors `PRINT_BOX`
 * in `usePrintCanvas.ts` and the pinned canvas size in `styles/print.css` —
 * keep all three in sync.
 */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { getCanvasInstanceMock } = vi.hoisted(() => ({ getCanvasInstanceMock: vi.fn() }));

vi.mock('@/services/canvasRef', () => ({ getCanvasInstance: getCanvasInstanceMock }));
// Deterministic bounds so the framing math is exact: a 100 × 250 diagram at
// the origin (taller than the box is wide → height drives the fit).
vi.mock('@xyflow/react', () => ({
  getNodesBounds: () => ({ x: 0, y: 0, width: 100, height: 250 }),
}));

import { usePrintCanvas } from '@/hooks/usePrintCanvas';

const BOX_W = 648;
const BOX_H = 760;
const PAD = 0.92;

function fakeRf(viewport = { x: 7, y: 9, zoom: 1 }) {
  return {
    getNodes: () => [{ id: 'a' }, { id: 'b' }],
    getViewport: () => viewport,
    setViewport: vi.fn(),
  };
}

afterEach(() => {
  // Unmount rendered hooks so their beforeprint/afterprint listeners unbind —
  // otherwise they accumulate across tests and fire on the next test's rf.
  cleanup();
  document.body.classList.remove('printing');
  document.body.innerHTML = '';
  getCanvasInstanceMock.mockReset();
});

describe('usePrintCanvas', () => {
  it('frames the diagram into the print box and toggles print state', () => {
    const rf = fakeRf({ x: 7, y: 9, zoom: 1 });
    getCanvasInstanceMock.mockReturnValue(rf);
    const minimap = document.createElement('div');
    minimap.className = 'react-flow__minimap';
    document.body.appendChild(minimap);

    renderHook(() => usePrintCanvas());
    act(() => {
      window.dispatchEvent(new Event('beforeprint'));
    });

    expect(document.body.classList.contains('printing')).toBe(true);
    expect(minimap.style.display).toBe('none');
    expect(rf.setViewport).toHaveBeenCalledTimes(1);

    const vp = rf.setViewport.mock.calls[0]?.[0] as { x: number; y: number; zoom: number };
    const expectedZoom = Math.min(BOX_W / 100, BOX_H / 250) * PAD;
    expect(vp.zoom).toBeCloseTo(expectedZoom, 5);
    // The diagram centre (50, 125) must land at the print-box centre.
    expect(vp.x + 50 * vp.zoom).toBeCloseTo(BOX_W / 2, 3);
    expect(vp.y + 125 * vp.zoom).toBeCloseTo(BOX_H / 2, 3);
  });

  it('restores the saved viewport and clears print state on afterprint', () => {
    const rf = fakeRf({ x: 42, y: 17, zoom: 0.8 });
    getCanvasInstanceMock.mockReturnValue(rf);
    const minimap = document.createElement('div');
    minimap.className = 'react-flow__minimap';
    document.body.appendChild(minimap);

    renderHook(() => usePrintCanvas());
    act(() => {
      window.dispatchEvent(new Event('beforeprint'));
    });
    act(() => {
      window.dispatchEvent(new Event('afterprint'));
    });

    expect(document.body.classList.contains('printing')).toBe(false);
    expect(minimap.style.display).toBe('');
    expect(rf.setViewport).toHaveBeenLastCalledWith({ x: 42, y: 17, zoom: 0.8 });
  });

  it('is a no-op for an empty canvas', () => {
    const rf = { getNodes: () => [], getViewport: vi.fn(), setViewport: vi.fn() };
    getCanvasInstanceMock.mockReturnValue(rf);

    renderHook(() => usePrintCanvas());
    act(() => {
      window.dispatchEvent(new Event('beforeprint'));
    });

    expect(rf.setViewport).not.toHaveBeenCalled();
    expect(document.body.classList.contains('printing')).toBe(false);
  });

  it('unbinds its listeners on unmount', () => {
    const rf = fakeRf();
    getCanvasInstanceMock.mockReturnValue(rf);

    const { unmount } = renderHook(() => usePrintCanvas());
    unmount();
    act(() => {
      window.dispatchEvent(new Event('beforeprint'));
    });

    expect(rf.setViewport).not.toHaveBeenCalled();
    expect(document.body.classList.contains('printing')).toBe(false);
  });
});
