import { useDocumentStore } from '@/store';
import { Syringe } from 'lucide-react';

/**
 * Session 87 / EC PPT comparison item #7 — Injection-summary chip.
 *
 * The canonical BESTSELLER EC workshop PPT keeps an "Injection(s)" box
 * prominently visible on the slide so practitioners can see, at a
 * glance, whether the diagnostic step has been completed. TP Studio's
 * `InjectionWorkbench` lives behind the EC inspector's Injections tab —
 * invisible until the user clicks an entity *and* the right tab. From
 * the canvas alone you cannot tell whether any injections exist.
 *
 * This chip surfaces the count directly on the canvas. Anchored
 * top-right (so it doesn't fight the existing top-center
 * VerbalisationStrip), zero-state included (renders even when no
 * injections exist, so the affordance is discoverable). Clicking opens
 * the Injections tab via `openInjectionsTab` — implemented as
 * `clearSelection` plus an opt-in tab id; the Inspector reads the
 * preferred tab on mount.
 */
export function ECInjectionChip() {
  const isEC = useDocumentStore((s) => s.doc.diagramType === 'ec');
  // Narrow selector — only re-emits when the injection count changes.
  const injectionCount = useDocumentStore(
    (s) => Object.values(s.doc.entities).filter((e) => e.type === 'injection').length
  );
  const requestInjectionsView = useDocumentStore((s) => s.requestECInjectionsView);

  if (!isEC) return null;

  const hasInjections = injectionCount > 0;
  return (
    <button
      type="button"
      data-component="ec-injection-chip"
      onClick={requestInjectionsView}
      aria-label={`Open injections (${injectionCount})`}
      title="Open the Injections tab"
      className={
        hasInjections
          ? 'pointer-events-auto flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 font-semibold text-[11px] text-emerald-800 shadow-sm transition hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200 dark:hover:bg-emerald-900'
          : 'pointer-events-auto flex items-center gap-1.5 rounded-full border border-neutral-300 bg-white/90 px-2.5 py-1 font-semibold text-[11px] text-neutral-600 shadow-sm transition hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:border-neutral-700 dark:bg-neutral-900/90 dark:text-neutral-300 dark:hover:bg-neutral-800'
      }
    >
      <Syringe className="h-3 w-3" aria-hidden />
      Injections ({injectionCount})
    </button>
  );
}
