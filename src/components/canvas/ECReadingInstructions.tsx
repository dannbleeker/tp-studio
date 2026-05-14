import { useDocumentStore } from '@/store';
import { X } from 'lucide-react';
import { useShallow } from 'zustand/shallow';

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
      isEC: s.doc.diagramType === 'ec',
    }))
  );

  if (!isEC || dismissed) return null;

  return (
    <aside
      data-component="ec-reading-instructions"
      aria-label="Evaporating Cloud reading instructions"
      className="mx-auto flex max-w-3xl items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50/95 px-3 py-1.5 text-[11px] text-indigo-900 shadow-sm backdrop-blur dark:border-indigo-800 dark:bg-indigo-950/95 dark:text-indigo-100"
    >
      <span className="font-semibold text-indigo-700 uppercase tracking-wide dark:text-indigo-300">
        Read every arrow:
      </span>
      <ol className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1">
        <li className="flex items-center gap-1">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-200 font-bold text-[9px] text-indigo-900 dark:bg-indigo-800 dark:text-indigo-100">
            1
          </span>
          <span>In order to&hellip;</span>
        </li>
        <li className="flex items-center gap-1">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-200 font-bold text-[9px] text-indigo-900 dark:bg-indigo-800 dark:text-indigo-100">
            2
          </span>
          <span>we must&hellip;</span>
        </li>
        <li className="flex items-center gap-1">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-200 font-bold text-[9px] text-indigo-900 dark:bg-indigo-800 dark:text-indigo-100">
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
        className="rounded p-0.5 text-indigo-500 transition hover:bg-indigo-100 hover:text-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-900 dark:hover:text-indigo-100"
      >
        <X className="h-3 w-3" />
      </button>
    </aside>
  );
}
