/**
 * `usePrintCanvas` — the browser-print framing hook (Session 178).
 *
 * On `beforeprint` it reads the `printLayout` pref and: injects an `@page`
 * size, pins the canvas row to a box sized from that page's content area,
 * frames the diagram into it (fit-one-page OR fit-to-width), flags
 * `body.printing`, and hides the MiniMap. On `afterprint` it puts everything
 * back. Empty canvas is a no-op; listeners unbind on unmount.
 *
 * The geometry constants below mirror those in `usePrintCanvas.ts` — keep them
 * in sync.
 */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PrintOrientation, PrintPaper, PrintScale } from '@/store/uiSlice/types';

type Layout = {
  paper: PrintPaper;
  orientation: PrintOrientation;
  scale: PrintScale;
  showLegend: boolean;
};

const { getCanvasInstanceMock, storeState } = vi.hoisted(() => ({
  getCanvasInstanceMock: vi.fn(),
  storeState: {
    printLayout: {
      paper: 'a4',
      orientation: 'portrait',
      scale: 'fit-page',
      showLegend: true,
    } as Layout,
  },
}));

vi.mock('@/services/canvasRef', () => ({ getCanvasInstance: getCanvasInstanceMock }));
vi.mock('@/store', () => ({ useDocumentStore: { getState: () => storeState } }));
// Deterministic bounds: a 100 × 250 diagram at the origin.
vi.mock('@xyflow/react', () => ({
  getNodesBounds: () => ({ x: 0, y: 0, width: 100, height: 250 }),
}));

import { usePrintCanvas } from '@/hooks/usePrintCanvas';

const PX_PER_MM = 96 / 25.4;
const MARGIN_PX = 0.75 * 96;
const RESERVE = 215;
const LEGEND_RESERVE = 90;
const PAD = 0.92;
const BOUNDS = { w: 100, h: 250 };
const PAGE_MM: Record<PrintPaper, { w: number; h: number }> = {
  a4: { w: 210, h: 297 },
  letter: { w: 215.9, h: 279.4 },
};

function content(paper: PrintPaper, orientation: PrintOrientation): { w: number; h: number } {
  const d = PAGE_MM[paper];
  const wMm = orientation === 'landscape' ? d.h : d.w;
  const hMm = orientation === 'landscape' ? d.w : d.h;
  return { w: wMm * PX_PER_MM - MARGIN_PX * 2, h: hMm * PX_PER_MM - MARGIN_PX * 2 };
}

function fakeRf(viewport = { x: 7, y: 9, zoom: 1 }) {
  return {
    getNodes: () => [{ id: 'a' }, { id: 'b' }],
    getViewport: () => viewport,
    setViewport: vi.fn(),
  };
}

function setupDom(): { row: HTMLElement; minimap: HTMLElement } {
  const row = document.createElement('div');
  row.setAttribute('data-print-canvas', '');
  const minimap = document.createElement('div');
  minimap.className = 'react-flow__minimap';
  document.body.append(row, minimap);
  return { row, minimap };
}

function setLayout(paper: PrintPaper, orientation: PrintOrientation, scale: PrintScale): void {
  storeState.printLayout = { paper, orientation, scale, showLegend: true };
}

afterEach(() => {
  cleanup();
  document.body.classList.remove('printing', 'print-include-legend');
  document.body.innerHTML = '';
  document.getElementById('tp-print-page-size')?.remove();
  getCanvasInstanceMock.mockReset();
  setLayout('a4', 'portrait', 'fit-page');
});

describe('usePrintCanvas', () => {
  it('fits the whole tree onto an A4 portrait page (default)', () => {
    const rf = fakeRf();
    getCanvasInstanceMock.mockReturnValue(rf);
    const { row, minimap } = setupDom();
    setLayout('a4', 'portrait', 'fit-page');

    renderHook(() => usePrintCanvas());
    act(() => window.dispatchEvent(new Event('beforeprint')));

    const c = content('a4', 'portrait');
    // The mock layout has showLegend: true, so the fit-one-page box reserves
    // the legend room as well as the header/footer.
    const fitH = c.h - RESERVE - LEGEND_RESERVE;
    const zoom = Math.min(c.w / BOUNDS.w, fitH / BOUNDS.h) * PAD;

    expect(document.body.classList.contains('printing')).toBe(true);
    expect(document.body.classList.contains('print-include-legend')).toBe(true);
    expect(minimap.style.display).toBe('none');
    expect(row.style.width).toBe(`${Math.round(c.w)}px`);
    expect(row.style.height).toBe(`${Math.round(fitH)}px`);
    expect(row.style.overflow).toBe('hidden');
    expect(document.getElementById('tp-print-page-size')?.textContent).toContain('A4 portrait');

    const vp = rf.setViewport.mock.calls[0]?.[0] as { x: number; y: number; zoom: number };
    expect(vp.zoom).toBeCloseTo(zoom, 4);
    // Diagram centre (50, 125) maps to the box centre.
    expect(vp.x + 50 * vp.zoom).toBeCloseTo(c.w / 2, 2);
    expect(vp.y + 125 * vp.zoom).toBeCloseTo(fitH / 2, 2);
  });

  it('fits to width and flows (overflow visible, tall box) when scale=fit-width', () => {
    const rf = fakeRf();
    getCanvasInstanceMock.mockReturnValue(rf);
    const { row } = setupDom();
    setLayout('a4', 'portrait', 'fit-width');

    renderHook(() => usePrintCanvas());
    act(() => window.dispatchEvent(new Event('beforeprint')));

    const c = content('a4', 'portrait');
    const zoom = (c.w / BOUNDS.w) * PAD;
    expect(row.style.overflow).toBe('visible');
    expect(row.style.width).toBe(`${Math.round(c.w)}px`);
    // Box height is the full scaled diagram height (+ padding), much taller
    // than a fit-page box — that's what makes it paginate.
    expect(Number.parseInt(row.style.height, 10)).toBe(Math.ceil(BOUNDS.h * zoom) + 16);
    const vp = rf.setViewport.mock.calls[0]?.[0] as { zoom: number };
    expect(vp.zoom).toBeCloseTo(zoom, 4);
  });

  it('honours Letter + landscape in the @page rule and box width', () => {
    const rf = fakeRf();
    getCanvasInstanceMock.mockReturnValue(rf);
    const { row } = setupDom();
    setLayout('letter', 'landscape', 'fit-page');

    renderHook(() => usePrintCanvas());
    act(() => window.dispatchEvent(new Event('beforeprint')));

    const c = content('letter', 'landscape');
    expect(document.getElementById('tp-print-page-size')?.textContent).toContain(
      'letter landscape'
    );
    expect(row.style.width).toBe(`${Math.round(c.w)}px`);
  });

  it('restores everything on afterprint', () => {
    const rf = fakeRf({ x: 42, y: 17, zoom: 0.8 });
    getCanvasInstanceMock.mockReturnValue(rf);
    const { row, minimap } = setupDom();

    renderHook(() => usePrintCanvas());
    act(() => window.dispatchEvent(new Event('beforeprint')));
    act(() => window.dispatchEvent(new Event('afterprint')));

    expect(document.body.classList.contains('printing')).toBe(false);
    expect(document.body.classList.contains('print-include-legend')).toBe(false);
    expect(minimap.style.display).toBe('');
    expect(row.style.width).toBe('');
    expect(row.style.height).toBe('');
    expect(document.getElementById('tp-print-page-size')).toBeNull();
    expect(rf.setViewport).toHaveBeenLastCalledWith({ x: 42, y: 17, zoom: 0.8 });
  });

  it('is a no-op for an empty canvas', () => {
    const rf = { getNodes: () => [], getViewport: vi.fn(), setViewport: vi.fn() };
    getCanvasInstanceMock.mockReturnValue(rf);
    setupDom();

    renderHook(() => usePrintCanvas());
    act(() => window.dispatchEvent(new Event('beforeprint')));

    expect(rf.setViewport).not.toHaveBeenCalled();
    expect(document.body.classList.contains('printing')).toBe(false);
    expect(document.getElementById('tp-print-page-size')).toBeNull();
  });

  it('unbinds its listeners on unmount', () => {
    const rf = fakeRf();
    getCanvasInstanceMock.mockReturnValue(rf);
    setupDom();

    const { unmount } = renderHook(() => usePrintCanvas());
    unmount();
    act(() => window.dispatchEvent(new Event('beforeprint')));

    expect(rf.setViewport).not.toHaveBeenCalled();
    expect(document.body.classList.contains('printing')).toBe(false);
  });
});
