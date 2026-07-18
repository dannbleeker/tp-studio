import clsx from 'clsx';
import { X } from 'lucide-react';
import { type ReactNode, type PointerEvent as ReactPointerEvent, useEffect, useState } from 'react';
import { Button } from '../ui/Button';

type Snap = 'half' | 'full';

// Snap heights as a share of the viewport. "half" is a comfortable one-handed
// height that keeps the canvas visible above; "full" is a near-full editor.
const SNAP_VH: Record<Snap, number> = { half: 52, full: 88 };
// Drag thresholds (px) — how far the grabber must travel to change snap / dismiss.
const EXPAND_AT = 60;
const COLLAPSE_AT = 60;
const DISMISS_AT = 110;

/**
 * Phone inspector shell — a bottom sheet instead of the desktop side slide-over.
 *
 * On a phone the 320px side panel would either cover the whole canvas or leave a
 * sliver; a bottom sheet is the platform-native pattern — the canvas stays
 * visible above it, and the sheet is reachable one-handed. Drag the grabber to
 * move between two snaps (half / full) or swipe it down to dismiss (which clears
 * the selection, same as the desktop X / backdrop). Always mounted + `inert`
 * when closed so the slide animation and focus/AT wiring match the desktop
 * `<aside>`.
 */
export function InspectorSheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const [snap, setSnap] = useState<Snap>('half');
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [startY, setStartY] = useState<number | null>(null);

  // Every fresh open starts at the half snap — a full-height sheet from a single
  // tap would be jarring, and half keeps the tapped node in view above.
  useEffect(() => {
    if (open) setSnap('half');
  }, [open]);

  const onPointerDown = (e: ReactPointerEvent): void => {
    setStartY(e.clientY);
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent): void => {
    if (startY === null) return;
    // Clamp upward drag so the sheet can't be flung above its full height.
    setDragY(Math.max(-40, e.clientY - startY));
  };
  const onPointerUp = (e: ReactPointerEvent): void => {
    if (startY === null) return;
    const delta = e.clientY - startY;
    setStartY(null);
    setDragging(false);
    setDragY(0);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    if (delta < -EXPAND_AT) setSnap('full');
    else if (delta > DISMISS_AT) onClose();
    else if (delta > COLLAPSE_AT && snap === 'full') setSnap('half');
    // Otherwise it snaps back to the current height (no state change).
  };

  return (
    <>
      {/* Tap-to-dismiss scrim above the canvas, below the sheet. */}
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        data-component="inspector-backdrop"
        data-open={open ? 'true' : undefined}
        className={clsx(
          'absolute inset-0 z-10 cursor-default bg-neutral-900/30 backdrop-blur-[1px] transition-opacity duration-150',
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
      />
      <aside
        aria-label="Inspector"
        aria-hidden={!open}
        {...({ inert: !open ? true : undefined } as Record<string, boolean | undefined>)}
        style={{
          height: `${SNAP_VH[snap]}vh`,
          transform: open ? `translateY(${dragY}px)` : 'translateY(100%)',
        }}
        className={clsx(
          'absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-2xl border-neutral-200 border-t bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-950',
          // No transition while the finger is down — the sheet must track the
          // drag 1:1; the ease-out plays on release (snap) and on open/close.
          !dragging && 'transition-[transform,height] duration-200 ease-out'
        )}
      >
        {/* Grabber + header is the drag surface. `touch-none` keeps the browser
            from scrolling the page while dragging the sheet. */}
        <div
          className="shrink-0 cursor-grab touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div
            className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-neutral-300 dark:bg-neutral-700"
            aria-hidden
          />
          <header className="flex items-center justify-between px-4 py-2">
            <h2 className="font-semibold text-neutral-700 text-sm dark:text-neutral-200">
              {title}
            </h2>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close inspector">
              <X className="h-4 w-4" />
            </Button>
          </header>
        </div>
        {/* The shared inspector body (tab bar + scrollable content). */}
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </aside>
    </>
  );
}
