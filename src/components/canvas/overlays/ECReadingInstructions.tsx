import { X } from 'lucide-react';
import { useShallow } from 'zustand/shallow';
import { useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';

/**
 * Session 87 / EC PPT comparison item #1 — Reading-instruction strip.
 *
 * The canonical BESTSELLER EC workshop PowerPoint puts a "1) In order to
 * … / 2) we must … / 3) because …" meta-instruction at the top of the
 * page as a reading guide for *how* to read any single arrow on the
 * diagram. The verbalisation strip below already renders the full
 * prose verbal form for THIS doc; this strip teaches the underlying
 * reading pattern.
 *
 * Visible only on EC docs and dismissible per session (the X button
 * flips the session-scoped `ecReadingInstructionsDismissed` flag).
 * Stacks ABOVE the VerbalisationStrip in the canvas top overlay.
 */
export function ECReadingInstructions() {
  const { dismissed, dismiss, isEC } = useDocumentStore(
    useShallow((s) => ({
      dismissed: s.ecReadingInstructionsDismissed,
      dismiss: s.dismissECReadingInstructions,
      isEC: currentDoc(s).diagramType === 'ec',
    }))
  );

  if (!isEC || dismissed) return null;

  return (
    <aside
      data-component="ec-reading-instructions"
      aria-label="Evaporating Cloud reading instructions"
      className="mx-auto flex max-w-3xl items-center gap-2 rounded-md border border-accent-200 bg-accent-50/95 px-3 py-1.5 text-[11px] text-accent-900 shadow-xs backdrop-blur-sm dark:border-accent-800 dark:bg-accent-950/95 dark:text-accent-100"
    >
      <span className="font-semibold text-accent-700 uppercase tracking-wide dark:text-accent-300">
        Read every arrow:
      </span>
      <ol className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1">
        <li className="flex items-center gap-1">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent-200 font-bold text-[9px] text-accent-900 dark:bg-accent-800 dark:text-accent-100">
            1
          </span>
          <span>In order to&hellip;</span>
        </li>
        <li className="flex items-center gap-1">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent-200 font-bold text-[9px] text-accent-900 dark:bg-accent-800 dark:text-accent-100">
            2
          </span>
          <span>we must&hellip;</span>
        </li>
        <li className="flex items-center gap-1">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent-200 font-bold text-[9px] text-accent-900 dark:bg-accent-800 dark:text-accent-100">
            3
          </span>
          <span>because&hellip;</span>
        </li>
      </ol>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss reading instructions"
        title="Dismiss"
        // Session 136 — bumped from `h-3 w-3 + p-0.5` to `h-4 w-4 +
        // p-1` so the dismiss affordance reads at the same visual
        // weight as the Modal close buttons elsewhere (Inspector,
        // About, Settings). The smaller icon was easy to miss in
        // the dense indigo strip.
        className="rounded-sm p-1 text-accent-600 transition hover:bg-accent-100 hover:text-accent-800 dark:text-accent-300 dark:hover:bg-accent-900 dark:hover:text-accent-100"
      >
        <X className="h-4 w-4" />
      </button>
    </aside>
  );
}
