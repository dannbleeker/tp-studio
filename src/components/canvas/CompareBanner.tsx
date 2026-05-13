import { useCompareDiff } from '@/hooks/useCompareDiff';
import { useDocumentStore } from '@/store';
import { X } from 'lucide-react';
import { useEffect } from 'react';
import { useShallow } from 'zustand/shallow';

/**
 * H2 visual-diff banner. Renders only when `compareRevisionId` is set.
 * Surfaces:
 *   - The compared revision's label (or its relative timestamp).
 *   - Counts of added / removed / changed entities and edges.
 *   - An exit button (also Esc).
 *   - A reminder that removed entities only show in the side-by-side
 *     dialog — the live canvas doesn't surface them on its own because
 *     it doesn't know where they would live geometrically.
 *
 * Mounted between the TopBar and Canvas in `App.tsx`; the banner pushes
 * the canvas down a few pixels when active.
 */
export function CompareBanner() {
  const { compareRevisionId, revisions, closeCompare } = useDocumentStore(
    useShallow((s) => ({
      compareRevisionId: s.compareRevisionId,
      revisions: s.revisions,
      closeCompare: s.closeCompare,
    }))
  );
  const diff = useCompareDiff();

  // Esc cascade. Compare mode is high-priority — Esc closes it before the
  // selection or hover would consume the key.
  useEffect(() => {
    if (!compareRevisionId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeCompare();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [compareRevisionId, closeCompare]);

  if (!compareRevisionId || !diff) return null;
  const rev = revisions.find((r) => r.id === compareRevisionId);
  const revLabel =
    rev?.label?.trim() || (rev ? `${new Date(rev.capturedAt).toLocaleString()}` : '');

  const addedCount = diff.entitiesAdded.size + diff.edgesAdded.size;
  const removedCount = diff.entitiesRemoved.size + diff.edgesRemoved.size;
  const changedCount = diff.entitiesChanged.size + diff.edgesChanged.size;

  return (
    <div className="absolute left-1/2 top-12 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full border border-indigo-300 bg-indigo-50/95 px-3 py-1.5 text-xs shadow-md backdrop-blur dark:border-indigo-700 dark:bg-indigo-950/90">
      <span className="font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
        Visual diff
      </span>
      <span className="text-neutral-700 dark:text-neutral-200">vs. {revLabel || 'snapshot'}</span>
      <span className="flex items-center gap-2 text-[11px]">
        {addedCount > 0 && (
          <span className="rounded-full bg-emerald-100 px-1.5 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100">
            +{addedCount}
          </span>
        )}
        {changedCount > 0 && (
          <span className="rounded-full bg-amber-100 px-1.5 text-amber-800 dark:bg-amber-900 dark:text-amber-100">
            ~{changedCount}
          </span>
        )}
        {removedCount > 0 && (
          <span className="rounded-full bg-red-100 px-1.5 text-red-800 dark:bg-red-900 dark:text-red-100">
            −{removedCount}
          </span>
        )}
        {addedCount === 0 && changedCount === 0 && removedCount === 0 && (
          <span className="text-neutral-500 dark:text-neutral-400">no differences</span>
        )}
      </span>
      <button
        type="button"
        onClick={closeCompare}
        className="rounded-full p-0.5 text-indigo-700 hover:bg-indigo-100 dark:text-indigo-300 dark:hover:bg-indigo-900"
        aria-label="Exit visual diff (Esc)"
        title="Exit visual diff (Esc)"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
