import { useReactFlow } from '@xyflow/react';
import { Maximize2, Minus, Plus } from 'lucide-react';
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

  return (
    <div
      data-component={DataComponent.CanvasNav}
      className="pointer-events-auto absolute bottom-3 left-1/2 z-10 ml-28 hidden -translate-x-1/2 select-none items-center gap-0.5 rounded-md border border-neutral-200 bg-white/90 p-0.5 shadow-xs sm:flex dark:border-neutral-800 dark:bg-neutral-900/90"
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
      {/* Session 135 — `aria-label` removed: the visible "{pct}%" text
          IS the accessible name; biome's `useAriaPropsSupportedByRole`
          flagged the redundant label on a plain `<span>`. Screen
          readers announce the text content directly. */}
      <span className="px-1.5 font-mono text-[10px] text-neutral-600 tabular-nums dark:text-neutral-300">
        {pct}%
      </span>
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
