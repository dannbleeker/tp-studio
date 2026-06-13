import clsx from 'clsx';
import { ScanSearch } from 'lucide-react';
import { useDocWarnings } from '@/hooks/useDocWarnings';
import { useDocumentStore } from '@/store';

/**
 * TopBar status chip — live CLR health for the WHOLE tree (the product's
 * differentiator, previously only visible per-selection in the Inspector).
 * Emerald "all clear" or amber "N to review"; clicking toggles the Logic-check
 * panel. Reads the shared `useDocWarnings()` so its count matches the panel and
 * the Inspector exactly. Its own component so only the chip — not the whole
 * TopBar — re-renders as the document changes.
 */
export function LogicChip() {
  const openCount = useDocWarnings().filter((w) => !w.resolved).length;
  const clrPanelOpen = useDocumentStore((s) => s.clrPanelOpen);
  const toggleClrPanel = useDocumentStore((s) => s.toggleClrPanel);
  const hasIssues = openCount > 0;

  return (
    <button
      type="button"
      onClick={toggleClrPanel}
      aria-pressed={clrPanelOpen}
      aria-label={hasIssues ? `Logic check: ${openCount} to review` : 'Logic check: all clear'}
      title={hasIssues ? 'Open the Logic check' : 'Logic check — all clear'}
      className={clsx(
        'pointer-events-auto inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-medium text-xs transition',
        hasIssues
          ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-300'
          : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300',
        clrPanelOpen && 'ring-2 ring-indigo-300 dark:ring-indigo-700'
      )}
    >
      <ScanSearch className="h-3.5 w-3.5" aria-hidden />
      <span>Logic</span>
      {hasIssues ? (
        <>
          <span className="rounded-full bg-amber-200/70 px-1.5 text-[10px] tabular-nums dark:bg-amber-800/60">
            {openCount}
          </span>
          <span className="hidden text-[11px] sm:inline">to review</span>
        </>
      ) : (
        <span className="hidden text-[11px] sm:inline">all clear</span>
      )}
    </button>
  );
}
