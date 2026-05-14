import type { ClrTier, Warning } from '@/domain/types';
import { runWarningAction } from '@/services/warningActions';
import { useDocumentStore } from '@/store';
import clsx from 'clsx';
import { AlertCircle, CheckCircle2, Wand2 } from 'lucide-react';

/**
 * Three-level CLR taxonomy (Block C / E5). Inspector renders warnings
 * grouped under these headers — clarity-of-statement issues first,
 * structural-existence issues second, sufficiency-of-cause issues third.
 * Matches how TOC practitioners walk a tree during a CLR review session.
 *
 * Each tier carries a short one-line description shown next to the
 * header, so even a fresh user sees what kind of issue they're looking
 * at without needing the docs.
 */
const TIER_ORDER: ClrTier[] = ['clarity', 'existence', 'sufficiency'];
const TIER_META: Record<ClrTier, { label: string; hint: string }> = {
  clarity: { label: 'Clarity', hint: 'Is the statement well-formed?' },
  existence: { label: 'Existence', hint: 'Does the structure make sense?' },
  sufficiency: { label: 'Sufficiency', hint: 'Is the cause enough on its own?' },
};

/** Stable sort: open warnings first, then resolved, preserving input order within each. */
const orderByResolution = (ws: Warning[]): Warning[] => {
  const open: Warning[] = [];
  const resolved: Warning[] = [];
  for (const w of ws) (w.resolved ? resolved : open).push(w);
  return [...open, ...resolved];
};

export function WarningsList({ warnings }: { warnings: Warning[] }) {
  const resolveWarning = useDocumentStore((s) => s.resolveWarning);
  const unresolveWarning = useDocumentStore((s) => s.unresolveWarning);
  const showToast = useDocumentStore((s) => s.showToast);

  const runAction = (w: Warning): void => {
    if (!w.action) return;
    const state = useDocumentStore.getState();
    const ok = runWarningAction(state, state.doc, w);
    if (ok) {
      showToast('success', `Applied: ${w.action.label}`);
    } else {
      showToast('info', `No handler registered for "${w.action.actionId}".`);
    }
  };

  if (warnings.length === 0) {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300">
        No CLR concerns.
      </div>
    );
  }

  // Group the (already-filtered) selection warnings by tier. Tiers with
  // zero warnings drop out of the rendered sections — no empty headers.
  const byTier: Record<ClrTier, Warning[]> = { clarity: [], existence: [], sufficiency: [] };
  for (const w of warnings) byTier[w.tier].push(w);

  const totalOpen = warnings.filter((w) => !w.resolved).length;
  const totalResolved = warnings.filter((w) => w.resolved).length;

  return (
    <div className="flex flex-col gap-3">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
        CLR ({totalOpen} open{totalResolved > 0 ? `, ${totalResolved} resolved` : ''})
      </span>
      {TIER_ORDER.map((tier) => {
        const tierWarnings = byTier[tier];
        if (tierWarnings.length === 0) return null;
        const tierMeta = TIER_META[tier];
        return (
          <section key={tier} className="flex flex-col gap-1.5">
            <span className="flex items-baseline gap-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              <span>{tierMeta.label}</span>
              <span className="font-normal normal-case tracking-normal text-neutral-400 dark:text-neutral-500">
                {tierMeta.hint}
              </span>
            </span>
            <ul className="flex flex-col gap-1.5">
              {orderByResolution(tierWarnings).map((w) => (
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
                    <p className="mt-0.5 text-[10px] uppercase tracking-wider opacity-60">
                      {w.ruleId}
                    </p>
                    {w.action && !w.resolved && (
                      <button
                        type="button"
                        onClick={() => runAction(w)}
                        aria-label={`${w.action.label} (one-click remedy)`}
                        className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900 transition hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-100 dark:hover:bg-amber-900/60"
                      >
                        <Wand2 className="h-3 w-3" aria-hidden />
                        {w.action.label}
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => (w.resolved ? unresolveWarning(w.id) : resolveWarning(w.id))}
                    aria-label={
                      w.resolved
                        ? `Reopen warning: ${w.message}`
                        : `Mark warning resolved: ${w.message}`
                    }
                    className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-neutral-600 opacity-0 transition hover:bg-white/60 focus:opacity-100 group-hover:opacity-100 dark:text-neutral-300 dark:hover:bg-neutral-800/60"
                  >
                    {w.resolved ? 'Reopen' : 'Resolve'}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
