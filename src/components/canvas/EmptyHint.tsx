/**
 * Shown when the canvas has no entities yet. Pure presentational — the
 * "double-click to add" gesture itself is handled by Canvas's
 * onDoubleClick.
 *
 * Session 87 (S3) — extended with two alternate entry paths so a new
 * user doesn't feel cornered into the double-click gesture. The kbd
 * elements use the same styling vocabulary as FirstEntityTip's
 * shortcut hints so the two surfaces read as one family.
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
          <strong className="font-medium text-neutral-700 dark:text-neutral-300">
            Double-click
          </strong>{' '}
          anywhere to add your first entity.
        </p>
        <p className="mt-2 text-[11px] text-neutral-500 dark:text-neutral-400">
          Or press{' '}
          <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1 py-px font-mono text-[10px] dark:border-neutral-700 dark:bg-neutral-800">
            Ctrl
          </kbd>
          +
          <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1 py-px font-mono text-[10px] dark:border-neutral-700 dark:bg-neutral-800">
            K
          </kbd>{' '}
          to open commands, or start from a{' '}
          <span className="font-medium text-neutral-600 dark:text-neutral-300">template</span> via{' '}
          <em>New from template…</em>.
        </p>
      </div>
    </div>
  );
}
