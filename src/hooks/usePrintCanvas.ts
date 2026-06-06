import { getNodesBounds, type Viewport } from '@xyflow/react';
import { useEffect } from 'react';
import { getCanvasInstance } from '@/services/canvasRef';

/**
 * The fixed print canvas box, in CSS px. `usePrintCanvas` frames the whole
 * diagram into this box and `print.css` pins the canvas element to the same
 * size while `body.printing` is set, so the fit is DETERMINISTIC — it never
 * depends on the screen size or on React Flow's async ResizeObserver
 * catching up to the print-media reflow. The browser then scales the box
 * uniformly to whatever paper the user picked. ~A4 portrait content area
 * (8.27in − 0.75in margins ≈ 6.8in ≈ 650px wide), a touch taller than wide.
 */
const PRINT_BOX = { width: 648, height: 760 };
const PRINT_PADDING = 0.92;

/**
 * Make the browser's native print (`Cmd/Ctrl+P`) and any `window.print()`
 * actually render the diagram.
 *
 * React Flow paints the canvas through a pan/zoom transform on
 * `.react-flow__viewport`. A bare `window.print()` captured whatever was in
 * the live view — and once the print stylesheet neutralised the viewport,
 * that was nothing: the page printed blank.
 *
 * On `beforeprint` (which fires for the native shortcut AND the Print-preview
 * dialog's "Open print dialog" button — both call `window.print()`), we:
 *   1. remember the user's current viewport,
 *   2. compute a transform that fits the diagram's bounding box into the
 *      fixed `PRINT_BOX`, and
 *   3. apply it via `setViewport`, so React Flow's store holds the print
 *      transform and re-asserts it if the print-media reflow triggers a
 *      re-render (otherwise the resize would clobber a raw DOM write).
 * The `printing` body class lets `print.css` pin the canvas element to
 * `PRINT_BOX`, matching the transform we just computed.
 *
 * On `afterprint` we restore the saved viewport exactly, so printing never
 * disturbs the user's pan or zoom. Empty canvases are skipped.
 */
export function usePrintCanvas(): void {
  useEffect(() => {
    let savedViewport: Viewport | null = null;

    const handleBeforePrint = (): void => {
      const rf = getCanvasInstance();
      if (!rf) return;
      const nodes = rf.getNodes();
      if (nodes.length === 0) return;
      const bounds = getNodesBounds(nodes);
      if (bounds.width === 0 || bounds.height === 0) return;

      savedViewport = rf.getViewport();
      const scaleX = PRINT_BOX.width / bounds.width;
      const scaleY = PRINT_BOX.height / bounds.height;
      const zoom = Math.min(scaleX, scaleY) * PRINT_PADDING;
      const x = PRINT_BOX.width / 2 - (bounds.x + bounds.width / 2) * zoom;
      const y = PRINT_BOX.height / 2 - (bounds.y + bounds.height / 2) * zoom;

      document.body.classList.add('printing');
      rf.setViewport({ x, y, zoom });

      // The MiniMap carries Tailwind's `sm:!block` — a *layered* `!important`
      // utility that out-ranks any `!important` rule print.css can write (a
      // layered important declaration beats an unlayered one). An inline
      // `!important` is the only thing above it, so hide the thumbnail here
      // and clear it on afterprint.
      for (const el of document.querySelectorAll<HTMLElement>('.react-flow__minimap')) {
        el.style.setProperty('display', 'none', 'important');
      }
    };

    const handleAfterPrint = (): void => {
      const rf = getCanvasInstance();
      document.body.classList.remove('printing');
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
