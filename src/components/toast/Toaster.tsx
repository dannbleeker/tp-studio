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

/**
 * Session 88 (S14) — toasts can now carry an optional `action` button
 * (e.g. Undo on template load). Clicking the action fires the stored
 * callback and immediately dismisses the toast so the affordance
 * doesn't linger after it's used. The button only renders when
 * `toast.action` is set; existing toasts without an action render
 * exactly as before.
 */
export function Toaster() {
  const toasts = useDocumentStore((s) => s.toasts);
  const dismiss = useDocumentStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div
      data-component="toaster"
      className="-translate-x-1/2 pointer-events-none fixed bottom-6 left-1/2 z-40 flex flex-col items-center gap-2"
    >
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
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action?.run();
                  dismiss(t.id);
                }}
                className={clsx(
                  'ml-1 rounded px-2 py-1 font-semibold text-[11px] uppercase tracking-wide transition',
                  t.action.prominent
                    ? // Session 91 — filled call-to-action. White text on a
                      // toast-kind-tinted background pulls the eye to the
                      // action when the toast itself is informational
                      // (e.g. PWA "New version available → Refresh now").
                      'bg-indigo-600 text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400 focus-visible:outline-offset-2 dark:bg-indigo-500 dark:hover:bg-indigo-400'
                    : 'border border-current/30 hover:bg-current/10'
                )}
              >
                {t.action.label}
              </button>
            )}
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
