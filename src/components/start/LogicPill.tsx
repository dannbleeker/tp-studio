import clsx from 'clsx';
import { CircleAlert, CircleCheck } from 'lucide-react';

/**
 * Session 183 — a tree's CLR status, mirroring the editor's TopBar Logic chip:
 * emerald "Logic clear" when no reservations are open, amber "N to review"
 * otherwise. The caller passes the count from {@link useSavedTrees}, which reads
 * the same pure `validate(doc)` the chip + inspector use — so the pill can
 * never drift from the editor.
 */
export function LogicPill({
  openWarnings,
  className,
}: {
  openWarnings: number;
  className?: string;
}) {
  const clear = openWarnings === 0;
  return (
    <span
      className={clsx(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-medium text-[11px]',
        clear
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
          : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
        className
      )}
    >
      {clear ? (
        <CircleCheck className="h-3 w-3" aria-hidden />
      ) : (
        <CircleAlert className="h-3 w-3" aria-hidden />
      )}
      {clear ? 'Logic clear' : `${openWarnings} to review`}
    </span>
  );
}
