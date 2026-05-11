import clsx from 'clsx';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import type { Warning } from '../../domain/types';
import { useDocumentStore } from '../../store';

export function WarningsList({ warnings }: { warnings: Warning[] }) {
  const resolveWarning = useDocumentStore((s) => s.resolveWarning);
  const unresolveWarning = useDocumentStore((s) => s.unresolveWarning);

  if (warnings.length === 0) {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300">
        No CLR concerns.
      </div>
    );
  }

  const open = warnings.filter((w) => !w.resolved);
  const resolved = warnings.filter((w) => w.resolved);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
        CLR ({open.length} open{resolved.length > 0 ? `, ${resolved.length} resolved` : ''})
      </span>
      <ul className="flex flex-col gap-1.5">
        {[...open, ...resolved].map((w) => (
          <li
            key={w.id}
            className={clsx(
              'group flex items-start gap-2 rounded-md border px-2.5 py-2 text-xs transition',
              w.resolved
                ? 'border-neutral-200 bg-neutral-50 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-500'
                : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200'
            )}
          >
            {w.resolved ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 translate-y-0.5" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5 shrink-0 translate-y-0.5" />
            )}
            <div className="flex-1">
              <p className={clsx(w.resolved && 'line-through decoration-neutral-400')}>
                {w.message}
              </p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wider opacity-60">{w.ruleId}</p>
            </div>
            <button
              type="button"
              onClick={() => (w.resolved ? unresolveWarning(w.id) : resolveWarning(w.id))}
              className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-neutral-600 opacity-0 transition hover:bg-white/60 group-hover:opacity-100 dark:text-neutral-300 dark:hover:bg-neutral-800/60"
            >
              {w.resolved ? 'Reopen' : 'Resolve'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
