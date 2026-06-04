import { useReactFlow } from '@xyflow/react';
import { Maximize2, Minus, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { DataComponent } from '@/components/dataComponentNames';
import { useZoomLevel } from '@/hooks/useZoomLevel';

/**
 * Session 133 — compact canvas navigation chip.
 *
 * Replaces the Session 87 React Flow `<Controls>` bar in the
 * bottom-left corner. Per user feedback that the flow-menu (zoom
 * buttons + fit-to-view) shouldn't squat the bottom-left where the
 * MiniMap already lives + the Toaster + selection-toolbar gestures
 * pass through, this combines the zoom-percent display with the
 * three commonly-used Controls (zoom out, zoom in, fit to view)
 * into one bottom-centre chip.
 *
 * Each button uses `useReactFlow()` to dispatch the same imperative
 * actions React Flow's built-in `<Controls>` does, so the behaviour
 * is identical — just the visual treatment + placement changed.
 * Showcase-mode `useStore` subscription via `useZoomLevel()` keeps
 * the percent text live without re-rendering the rest of the canvas.
 *
 * `+` / `-` / `0` keyboard shortcuts (registered in
 * `useGlobalShortcuts`) still work; this chip is the discoverable
 * surface for users who reach for the mouse first.
 */
export function CanvasNav() {
  const zoom = useZoomLevel();
  const pct = Math.round(zoom * 100);
  const flow = useReactFlow();
  // Z-1 — click the percent to type an exact zoom. `zoomTo` clamps to React
  // Flow's configured minZoom/maxZoom, so an out-of-range number just lands at
  // the nearest allowed zoom; an unparseable value is ignored.
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const commit = (raw: string) => {
    const n = Number.parseFloat(raw.replace('%', '').trim());
    if (Number.isFinite(n) && n > 0) flow.zoomTo(n / 100, { duration: 200 });
    setEditing(false);
  };
  // Focus + select the inline editor when it opens (no `autoFocus` — avoids the
  // a11y lint; same pattern as TPNode's title editor).
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  return (
    <div
      data-component={DataComponent.CanvasNav}
      className="pointer-events-auto absolute bottom-3 left-1/2 z-10 ml-28 hidden -translate-x-1/2 select-none items-center gap-0.5 rounded-md border border-neutral-200 bg-white/95 p-0.5 shadow-xs sm:flex dark:border-neutral-800 dark:bg-neutral-900/95"
    >
      <button
        type="button"
        onClick={() => flow.zoomOut()}
        className="rounded-sm p-1 text-neutral-600 hover:bg-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-400 dark:text-neutral-300 dark:hover:bg-neutral-800"
        aria-label="Zoom out"
        title="Zoom out  (-)"
      >
        <Minus className="h-3 w-3" />
      </button>
      {/* Z-1 — click the percent to type an exact zoom. The visible text is the
          accessible name (Session 135 dropped a redundant aria-label on the
          read-only span). */}
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          defaultValue={String(pct)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit(e.currentTarget.value);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setEditing(false);
            }
            // Don't let the canvas +/-/0 zoom shortcuts fire while typing.
            e.stopPropagation();
          }}
          onBlur={(e) => commit(e.currentTarget.value)}
          aria-label="Set zoom percent"
          className="w-9 rounded-sm bg-neutral-100 px-1 text-center font-mono text-[10px] text-neutral-700 tabular-nums outline-hidden ring-1 ring-indigo-400 dark:bg-neutral-800 dark:text-neutral-200"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-sm px-1.5 font-mono text-[10px] text-neutral-600 tabular-nums hover:bg-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-400 dark:text-neutral-300 dark:hover:bg-neutral-800"
          title="Set zoom % (click to type)"
        >
          {pct}%
        </button>
      )}
      <button
        type="button"
        onClick={() => flow.zoomIn()}
        className="rounded-sm p-1 text-neutral-600 hover:bg-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-400 dark:text-neutral-300 dark:hover:bg-neutral-800"
        aria-label="Zoom in"
        title="Zoom in  (+)"
      >
        <Plus className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={() => flow.fitView({ padding: 0.4, maxZoom: 1.2 })}
        className="rounded-sm p-1 text-neutral-600 hover:bg-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-400 dark:text-neutral-300 dark:hover:bg-neutral-800"
        aria-label="Fit view"
        title="Fit view  (0)"
      >
        <Maximize2 className="h-3 w-3" />
      </button>
    </div>
  );
}
