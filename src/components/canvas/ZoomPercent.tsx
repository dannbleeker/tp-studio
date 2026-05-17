import { useZoomLevel } from '@/hooks/useZoomLevel';

/**
 * Tiny live zoom percentage shown to the right of the bottom-center Controls.
 * Reads the React Flow transform directly so it updates as the user pans/zooms
 * without re-rendering the whole canvas. Subscription is via the shared
 * `useZoomLevel()` hook so future zoom-aware components share one entry
 * point (Session 46 Block 0.4).
 */
export function ZoomPercent() {
  const zoom = useZoomLevel();
  const pct = Math.round(zoom * 100);
  return (
    <div
      data-component="zoom-percent"
      className="pointer-events-none absolute bottom-3 left-1/2 z-10 ml-28 hidden -translate-x-1/2 select-none rounded-md border border-neutral-200 bg-white/90 px-1.5 py-0.5 font-mono text-[10px] text-neutral-600 shadow-sm sm:block dark:border-neutral-800 dark:bg-neutral-900/90 dark:text-neutral-300"
    >
      {pct}%
    </div>
  );
}
