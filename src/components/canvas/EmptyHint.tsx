/**
 * Shown when the canvas has no entities yet. Pure presentational — the
 * "double-click to add" gesture itself is handled by Canvas's onDoubleClick.
 */
export function EmptyHint() {
  return (
    <div
      data-component="empty-hint"
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      <div className="rounded-xl border border-neutral-200 bg-white/80 px-6 py-5 text-center shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/80">
        <p className="font-medium text-neutral-700 text-sm dark:text-neutral-200">Empty diagram</p>
        <p className="mt-1 text-neutral-500 text-ui dark:text-neutral-400">
          Double-click anywhere to add your first entity.
        </p>
      </div>
    </div>
  );
}
