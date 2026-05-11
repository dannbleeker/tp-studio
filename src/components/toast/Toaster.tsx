import { useDocumentStore } from '@/store';
import clsx from 'clsx';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

const ICONS = {
  info: Info,
  success: CheckCircle2,
  error: AlertCircle,
} as const;

const STYLES = {
  info: 'border-neutral-200 bg-white text-neutral-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200',
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/60 dark:text-emerald-200',
  error:
    'border-red-200 bg-red-50 text-red-800 dark:border-red-900/40 dark:bg-red-950/60 dark:text-red-200',
} as const;

export function Toaster() {
  const toasts = useDocumentStore((s) => s.toasts);
  const dismiss = useDocumentStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => {
        const Icon = ICONS[t.kind];
        return (
          <output
            key={t.id}
            className={clsx(
              'pointer-events-auto flex items-center gap-2 rounded-lg border px-3 py-2 text-sm shadow-lg',
              STYLES[t.kind]
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="ml-1 rounded p-0.5 opacity-60 transition hover:opacity-100"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </output>
        );
      })}
    </div>
  );
}
