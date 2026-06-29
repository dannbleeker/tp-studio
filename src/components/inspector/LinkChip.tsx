import clsx from 'clsx';
import { Link2, RotateCcw } from 'lucide-react';

/**
 * Shared cross-document link chip (Session 185) — the button rendered by both
 * `EntityLinksSection` and the injection-flower dialog. A reachable target shows
 * an indigo "Go to <entity> · <doc>" link; a closed target shows a muted "Reopen
 * linked tab" with a reopen icon (clicking reopens the saved tree and follows the
 * link). The caller owns the click (navigate-or-reopen) and how the target was
 * resolved (open `docs` vs a pre-resolved flower link), so this stays purely
 * presentational.
 */
export function LinkChip({
  reachable,
  title,
  docTitle,
  onClick,
  className,
}: {
  reachable: boolean;
  /** The linked entity's title (shown when reachable). */
  title: string;
  /** The target document's title (shown when reachable). */
  docTitle: string;
  onClick: () => void;
  /** Extra button classes — e.g. `flex-1` when the chip is flanked by an unlink ×. */
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={
        reachable
          ? `Go to "${title || 'entity'}" in ${docTitle}`
          : 'Reopen its tab and follow this link.'
      }
      className={clsx(
        'flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-1 text-left text-xs transition',
        reachable
          ? 'border-accent-200 bg-accent-50/60 text-accent-800 hover:bg-accent-100 dark:border-accent-900 dark:bg-accent-950/40 dark:text-accent-200 dark:hover:bg-accent-900/50'
          : 'border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-700 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-200',
        className
      )}
    >
      {reachable ? (
        <Link2 aria-hidden className="h-3 w-3 shrink-0" />
      ) : (
        <RotateCcw aria-hidden className="h-3 w-3 shrink-0" />
      )}
      <span className="truncate">
        {reachable ? (
          <>
            {title || '(untitled)'}
            <span className="ml-1 text-accent-500/70 dark:text-accent-300/60">· {docTitle}</span>
          </>
        ) : (
          <span className="italic">Reopen linked tab</span>
        )}
      </span>
    </button>
  );
}
