import { type RefObject, useCallback, useRef, useState } from 'react';

/**
 * Session 135 — extracted from `CreationWizardPanel.tsx` (file split).
 * Session 88 (S18) drag-to-reposition: a header band acts as a drag
 * handle. Pointerdown begins a drag (tracking the grab offset so the
 * cursor stays anchored to the grabbed point), pointermove updates a
 * live position clamped to the viewport, pointerup commits via
 * `onCommit`. Returns the ref to attach to the panel, the pointer
 * handlers to spread on the drag-handle element, and the resolved
 * inline position (live drag → committed → null = use CSS default).
 *
 * Inner interactive controls (buttons) on the handle short-circuit the
 * drag via a `closest('button')` check, so clicks reach those handlers.
 */
export function useDraggablePanel(opts: {
  /** The persisted position, or `null` to fall back to the CSS default. */
  committed: { x: number; y: number } | null;
  /** Called on pointerup with the final position to persist. */
  onCommit: (x: number, y: number) => void;
}): {
  panelRef: RefObject<HTMLDivElement | null>;
  dragHandlers: {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
    onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => void;
  };
  /** Inline style position while dragging / when committed; `null` =
   *  no inline style, let the caller's CSS default apply. */
  positioned: { left: number; top: number } | null;
} {
  const { committed, onCommit } = opts;
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ dx: number; dy: number; live: { x: number; y: number } } | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);

  /** Clamp a position so the panel stays mostly on-screen — keep ~40 px
   *  visible on every side so the user can always grab it back. The `h`
   *  parameter is unused at present (the vertical clamp uses a fixed
   *  pixel margin against viewport height) but kept in the signature so
   *  a future tweak can use it without changing call-sites. */
  const clampToViewport = useCallback((x: number, y: number, w: number, _h: number) => {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
    const minVisible = 40;
    const cx = Math.max(minVisible - w, Math.min(vw - minVisible, x));
    const cy = Math.max(0, Math.min(vh - minVisible, y));
    return { x: cx, y: cy };
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only respond to primary-button drags on the handle SURFACE
    // itself — clicks that started on an inner button should reach
    // those handlers, not start a drag.
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button')) return;
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    dragRef.current = {
      dx: e.clientX - rect.left,
      dy: e.clientY - rect.top,
      live: { x: rect.left, y: rect.top },
    };
    setDragPos({ x: rect.left, y: rect.top });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const panel = panelRef.current;
    if (!drag || !panel) return;
    const rect = panel.getBoundingClientRect();
    const next = clampToViewport(e.clientX - drag.dx, e.clientY - drag.dy, rect.width, rect.height);
    drag.live = next;
    setDragPos(next);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    onCommit(drag.live.x, drag.live.y);
    dragRef.current = null;
    setDragPos(null);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const onPointerCancel = (): void => {
    // A cancelled pointer (OS-stolen gesture, stylus lift) discards the drag
    // rather than committing the last tracked position. Capture is already
    // implicitly released on cancel, so don't call releasePointerCapture —
    // it throws on a cancelled pointer in some browsers.
    dragRef.current = null;
    setDragPos(null);
  };

  // Live drag overrides committed; committed overrides default.
  const positioned =
    dragPos !== null
      ? { left: dragPos.x, top: dragPos.y }
      : committed !== null
        ? { left: committed.x, top: committed.y }
        : null;

  return {
    panelRef,
    dragHandlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
    positioned,
  };
}
