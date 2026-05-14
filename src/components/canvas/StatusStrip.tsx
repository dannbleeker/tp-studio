import { DataComponent } from '@/components/dataComponentNames';
import { useDocumentStore } from '@/store';
import clsx from 'clsx';
import { Eye, GitBranch, History, Lock, Search, Sparkles } from 'lucide-react';
import { useShallow } from 'zustand/shallow';

/**
 * Session 87 (S24) — Global status strip.
 *
 * Pre-fix, several "secondary" mode states had no centralized
 * indicator: the user could be browsing a locked doc, hoisted into a
 * group, with the history panel open, with a creation wizard active,
 * with the search panel open, AND in compare mode — and the only
 * signal for each was a distinct piece of chrome scattered across the
 * UI. Easy to lose track.
 *
 * This strip renders a small chip per ACTIVE state, bottom-right of
 * the canvas. Inactive states don't render. When nothing is active
 * the strip itself renders nothing (no empty padding chrome).
 *
 * Each chip is informational only (no interactive controls) — clicking
 * it focuses the relevant primary surface (e.g. clicking the History
 * chip toggles the history panel). The chips are *summaries*; the
 * existing buttons / panels / breadcrumbs remain the authoritative
 * controls.
 *
 * Anchored bottom-RIGHT to stay clear of the bottom-left Controls /
 * MiniMap stack and the centered Toaster.
 */
export function StatusStrip() {
  const {
    browseLocked,
    hoistedGroupId,
    historyPanelOpen,
    creationWizardActive,
    searchOpen,
    compareRevisionId,
    setBrowseLocked,
    toggleHistoryPanel,
    closeSearch,
    closeCompare,
    unhoist,
    closeCreationWizard,
  } = useDocumentStore(
    useShallow((s) => ({
      browseLocked: s.browseLocked,
      hoistedGroupId: s.hoistedGroupId,
      historyPanelOpen: s.historyPanelOpen,
      creationWizardActive: s.creationWizard !== null,
      searchOpen: s.searchOpen,
      compareRevisionId: s.compareRevisionId,
      setBrowseLocked: s.setBrowseLocked,
      toggleHistoryPanel: s.toggleHistoryPanel,
      closeSearch: s.closeSearch,
      closeCompare: s.closeCompare,
      unhoist: s.unhoist,
      closeCreationWizard: s.closeCreationWizard,
    }))
  );

  const chips: {
    key: string;
    label: string;
    Icon: typeof Lock;
    onClick: () => void;
    tone: string;
  }[] = [];

  if (browseLocked) {
    chips.push({
      key: 'lock',
      label: 'Browse Lock',
      Icon: Lock,
      tone: 'violet',
      onClick: () => setBrowseLocked(false),
    });
  }
  if (hoistedGroupId) {
    // Hoist is shown elsewhere via the Breadcrumb. The chip here is a
    // shortcut to exit; clicking it clears the hoist. (Breadcrumb still
    // works for navigating IN to a group.)
    chips.push({
      key: 'hoist',
      label: 'Hoisted',
      Icon: GitBranch,
      tone: 'amber',
      onClick: unhoist,
    });
  }
  if (historyPanelOpen) {
    chips.push({
      key: 'history',
      label: 'History',
      Icon: History,
      tone: 'sky',
      onClick: toggleHistoryPanel,
    });
  }
  if (creationWizardActive) {
    chips.push({
      key: 'wizard',
      label: 'Wizard',
      Icon: Sparkles,
      tone: 'indigo',
      onClick: closeCreationWizard,
    });
  }
  if (searchOpen) {
    chips.push({
      key: 'search',
      label: 'Search',
      Icon: Search,
      tone: 'neutral',
      onClick: closeSearch,
    });
  }
  if (compareRevisionId) {
    chips.push({
      key: 'compare',
      label: 'Compare',
      Icon: Eye,
      tone: 'emerald',
      onClick: closeCompare,
    });
  }

  if (chips.length === 0) return null;

  return (
    <aside
      data-component={DataComponent.StatusStrip}
      aria-label="Active modes"
      className="pointer-events-none absolute right-4 bottom-4 z-10 flex flex-wrap items-center justify-end gap-1.5"
    >
      {chips.map(({ key, label, Icon, onClick, tone }) => (
        <button
          key={key}
          type="button"
          onClick={onClick}
          // Clicking a chip dismisses the corresponding mode (unlock,
          // exit hoist, close panel, close wizard, etc.). The verb
          // varies, the gesture is consistent — "click to leave this
          // mode."
          title={`Click to exit ${label}`}
          aria-label={`Exit ${label}`}
          className={clsx(
            'pointer-events-auto flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium text-[10px] shadow-sm backdrop-blur transition',
            // Tone palette — keeps the strip readable in both light
            // and dark themes without one-off per-chip Tailwind
            // overrides bleeding into every spot.
            tone === 'violet' &&
              'border-violet-300 bg-violet-50/95 text-violet-800 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/80 dark:text-violet-200 dark:hover:bg-violet-900',
            tone === 'amber' &&
              'border-amber-300 bg-amber-50/95 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/80 dark:text-amber-200 dark:hover:bg-amber-900',
            tone === 'sky' &&
              'border-sky-300 bg-sky-50/95 text-sky-800 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/80 dark:text-sky-200 dark:hover:bg-sky-900',
            tone === 'indigo' &&
              'border-indigo-300 bg-indigo-50/95 text-indigo-800 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-200 dark:hover:bg-indigo-900',
            tone === 'neutral' &&
              'border-neutral-300 bg-neutral-50/95 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900/80 dark:text-neutral-300 dark:hover:bg-neutral-800',
            tone === 'emerald' &&
              'border-emerald-300 bg-emerald-50/95 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-200 dark:hover:bg-emerald-900'
          )}
        >
          <Icon className="h-3 w-3" aria-hidden />
          {label}
        </button>
      ))}
    </aside>
  );
}
