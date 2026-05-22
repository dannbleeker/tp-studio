import { Check, FlaskConical, Undo2 } from 'lucide-react';
import { useEffect } from 'react';
import { useShallow } from 'zustand/shallow';
import { useDocumentStore } from '@/store';

/**
 * Session 135 / spec gap #4 Phase 1C — what-if speculation banner.
 *
 * Renders only while a speculation overlay is active
 * (`speculationOverlay !== null`). Surfaces:
 *   - A "Speculating" label + the count of hypothetical overrides.
 *   - **Commit** — write the overrides into the persisted
 *     `entity.state` (one undo step) and exit.
 *   - **Revert** — discard the overlay and exit (also Esc).
 *
 * While speculation is active the canvas state badges reflect the
 * hypothetical cascade (dashed-ring badges mark the overridden
 * entities); the EntityInspector's state picker writes to the overlay
 * rather than the doc. Mounted in `App.tsx` near the CompareBanner.
 */
export function SpeculationBanner() {
  const { overlay, commit, revert } = useDocumentStore(
    useShallow((s) => ({
      overlay: s.speculationOverlay,
      commit: s.commitSpeculation,
      revert: s.revertSpeculation,
    }))
  );

  // Esc reverts — same high-priority Esc-cascade treatment as the
  // compare banner. Discarding is the safe default for an accidental Esc.
  useEffect(() => {
    if (overlay === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        revert();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [overlay, revert]);

  if (overlay === null) return null;
  const count = Object.keys(overlay).length;

  return (
    <div className="absolute top-12 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full border border-indigo-300 bg-indigo-50/95 px-3 py-1.5 text-xs shadow-md backdrop-blur-sm dark:border-indigo-700 dark:bg-indigo-950/90">
      <span className="flex items-center gap-1.5 font-semibold text-indigo-700 uppercase tracking-wider dark:text-indigo-300">
        <FlaskConical className="h-3.5 w-3.5" />
        Speculating
      </span>
      <span className="text-neutral-700 dark:text-neutral-200">
        {count === 0
          ? 'Pick an entity state to explore the cascade'
          : `${count} hypothetical ${count === 1 ? 'change' : 'changes'}`}
      </span>
      <button
        type="button"
        onClick={commit}
        disabled={count === 0}
        className="flex items-center gap-1 rounded-full bg-indigo-600 px-2 py-0.5 font-medium text-[11px] text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Commit speculative states to the document"
        title="Commit — write these states into the document (one undo)"
      >
        <Check className="h-3 w-3" />
        Commit
      </button>
      <button
        type="button"
        onClick={revert}
        className="flex items-center gap-1 rounded-full border border-indigo-300 px-2 py-0.5 font-medium text-[11px] text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900"
        aria-label="Revert speculation (Esc)"
        title="Revert — discard these hypotheticals (Esc)"
      >
        <Undo2 className="h-3 w-3" />
        Revert
      </button>
    </div>
  );
}
