import { getNodesBounds, type Viewport } from '@xyflow/react';
import { useEffect } from 'react';
import { getCanvasInstance } from '@/services/canvasRef';
import { useDocumentStore } from '@/store';

/**
 * Make the browser's native print (`Cmd/Ctrl+P`) and any `window.print()`
 * actually render the diagram, honouring the persisted print page setup.
 *
 * React Flow paints the canvas through a pan/zoom transform on
 * `.react-flow__viewport`. A bare `window.print()` captured whatever was in
 * the live view — and once the print stylesheet neutralised the viewport,
 * that was nothing: the page printed blank.
 *
 * On `beforeprint` (which fires for the native shortcut AND the Print
 * dialog's "Open print dialog" button) we read the `printLayout` pref
 * (paper · orientation · scale), then:
 *   - inject an `@page { size }` so the browser dialog defaults to the chosen
 *     paper + orientation and the printed area matches the box we frame to;
 *   - pin the canvas row to a fixed box sized from that page's content area;
 *   - frame the diagram into it — either fitting the WHOLE tree onto one page
 *     (`fit-page`) or scaling to the page WIDTH and letting the full height
 *     flow down across pages (`fit-width`).
 * Everything is applied imperatively (inline styles + `setViewport`) so the
 * framing is deterministic regardless of screen size or print-media reflow
 * timing. On `afterprint` we put the viewport, the canvas box, the `@page`
 * style and the MiniMap back exactly as they were. Empty canvas is a no-op.
 */

const PX_PER_MM = 96 / 25.4;
/** `@page` margin (0.75in) — matches the `@page { margin }` in print.css. */
const MARGIN_PX = 0.75 * 96;
/** Header (title H1 + spacing) + footer band kept off the fit-one-page box
 *  so they sit above / below the diagram on a single page. */
const HEADER_FOOTER_RESERVE_PX = 215;
const PRINT_PADDING = 0.92;

const PAGE_MM: Record<'a4' | 'letter', { w: number; h: number }> = {
  a4: { w: 210, h: 297 },
  letter: { w: 215.9, h: 279.4 },
};
const CSS_PAPER: Record<'a4' | 'letter', string> = { a4: 'A4', letter: 'letter' };
const PAGE_STYLE_ID = 'tp-print-page-size';
const BOX_STYLE_PROPS = ['width', 'height', 'flex', 'overflow', 'margin'] as const;

/** Printable content box (page minus margins), in CSS px, honouring orientation. */
function contentBoxPx(
  paper: 'a4' | 'letter',
  orientation: 'portrait' | 'landscape'
): { w: number; h: number } {
  const dims = PAGE_MM[paper];
  const wMm = orientation === 'landscape' ? dims.h : dims.w;
  const hMm = orientation === 'landscape' ? dims.w : dims.h;
  return { w: wMm * PX_PER_MM - MARGIN_PX * 2, h: hMm * PX_PER_MM - MARGIN_PX * 2 };
}

export function usePrintCanvas(): void {
  useEffect(() => {
    let savedViewport: Viewport | null = null;
    let sizedRow: HTMLElement | null = null;

    const handleBeforePrint = (): void => {
      const rf = getCanvasInstance();
      if (!rf) return;
      const nodes = rf.getNodes();
      if (nodes.length === 0) return;
      const bounds = getNodesBounds(nodes);
      if (bounds.width === 0 || bounds.height === 0) return;

      const { paper, orientation, scale } = useDocumentStore.getState().printLayout;
      const content = contentBoxPx(paper, orientation);
      savedViewport = rf.getViewport();

      // Inject the @page size so the browser dialog defaults to this paper +
      // orientation (and the printable area matches the box we frame to).
      let pageStyle = document.getElementById(PAGE_STYLE_ID);
      if (!pageStyle) {
        pageStyle = document.createElement('style');
        pageStyle.id = PAGE_STYLE_ID;
        document.head.appendChild(pageStyle);
      }
      pageStyle.textContent = `@page { size: ${CSS_PAPER[paper]} ${orientation}; }`;

      const cx = bounds.x + bounds.width / 2;
      const cy = bounds.y + bounds.height / 2;
      let boxW: number;
      let boxH: number;
      let overflow: string;
      let zoom: number;
      let x: number;
      let y: number;

      if (scale === 'fit-width') {
        // Scale so the tree's width fills the page; let the full height flow
        // down across as many pages as the browser needs.
        zoom = (content.w / bounds.width) * PRINT_PADDING;
        boxW = content.w;
        boxH = Math.ceil(bounds.height * zoom) + 16;
        overflow = 'visible';
        x = content.w / 2 - cx * zoom;
        y = 8 - bounds.y * zoom;
      } else {
        // Fit the whole tree onto one page (header above, footer below).
        const fitH = content.h - HEADER_FOOTER_RESERVE_PX;
        zoom = Math.min(content.w / bounds.width, fitH / bounds.height) * PRINT_PADDING;
        boxW = content.w;
        boxH = Math.round(fitH);
        overflow = 'hidden';
        x = content.w / 2 - cx * zoom;
        y = fitH / 2 - cy * zoom;
      }

      const row = document.querySelector<HTMLElement>('[data-print-canvas]');
      if (row) {
        sizedRow = row;
        row.style.setProperty('width', `${Math.round(boxW)}px`, 'important');
        row.style.setProperty('height', `${boxH}px`, 'important');
        row.style.setProperty('flex', 'none', 'important');
        row.style.setProperty('overflow', overflow, 'important');
        row.style.setProperty('margin', '0 auto', 'important');
      }
      document.body.classList.add('printing');
      rf.setViewport({ x, y, zoom });

      // The MiniMap carries Tailwind's `sm:!block` — a layered `!important`
      // that out-ranks any rule print.css can write; only an inline
      // `!important` is above it.
      for (const el of document.querySelectorAll<HTMLElement>('.react-flow__minimap')) {
        el.style.setProperty('display', 'none', 'important');
      }
    };

    const handleAfterPrint = (): void => {
      const rf = getCanvasInstance();
      document.body.classList.remove('printing');
      if (sizedRow) {
        for (const prop of BOX_STYLE_PROPS) sizedRow.style.removeProperty(prop);
        sizedRow = null;
      }
      document.getElementById(PAGE_STYLE_ID)?.remove();
      for (const el of document.querySelectorAll<HTMLElement>('.react-flow__minimap')) {
        el.style.removeProperty('display');
      }
      if (rf && savedViewport) rf.setViewport(savedViewport);
      savedViewport = null;
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);
}
