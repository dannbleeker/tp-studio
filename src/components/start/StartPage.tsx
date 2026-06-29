import { Search } from 'lucide-react';
import { PATTERNS } from '@/domain/patterns';
import { useDocumentStore } from '@/store';
import type { StartSection } from '@/store/uiSlice/types';
import { LearnSection } from './LearnSection';
import { StartHome } from './StartHome';
import { StartSidebar } from './StartSidebar';
import { TemplateGallery } from './TemplateGallery';
import { TreeGallery } from './TreeGallery';
import { TreeList } from './TreeList';
import { useSavedTrees } from './useSavedTrees';

const SECTION_TITLE: Record<StartSection, string> = {
  start: 'Start',
  allTrees: 'All trees',
  recent: 'Recent',
  templates: 'Templates',
  needsReview: 'Needs review',
  learn: 'Learn the method',
};

const isMac = typeof navigator !== 'undefined' && /Mac|iP(hone|ad)/.test(navigator.platform);

/**
 * Session 183 — the Start (workspace) shell: a persistent left sidebar whose
 * nav drives the `startSection` view, and a main column with a slim header
 * (section name + ⌘K command/search) over a per-section body. Renders in place
 * of the editor when a Start section is active; the editor's dialog/overlay
 * block stays mounted in App, so ⌘K, toasts, and the pickers work here too.
 *
 * Section bodies fill in over Stages B–D (Templates, the hero + strip, the tree
 * galleries + Logic-status cards).
 */
export function StartPage() {
  const section = useDocumentStore((s) => s.startSection) ?? 'start';
  const togglePalette = useDocumentStore((s) => s.togglePalette);

  return (
    <div className="flex flex-1 overflow-hidden bg-white dark:bg-neutral-950">
      <StartSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-3 border-neutral-200 border-b px-6 py-3 dark:border-neutral-800">
          <span className="font-medium text-neutral-900 text-sm dark:text-neutral-100">
            {SECTION_TITLE[section]}
          </span>
          <button
            type="button"
            onClick={togglePalette}
            aria-label="Search or run a command"
            className="flex w-full max-w-xs items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-neutral-400 text-sm transition hover:border-neutral-300 hover:text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
          >
            <Search className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="flex-1 truncate text-left">Search trees…</span>
            <kbd className="rounded border border-neutral-200 px-1.5 py-0.5 font-medium text-[10px] text-neutral-400 dark:border-neutral-700">
              {isMac ? '⌘K' : 'Ctrl K'}
            </kbd>
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-6 py-8">
            <StartSectionBody section={section} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Per-section body. The open trees are read once here and shared with the
 *  Start view's "pick up where you left off" + the gallery sections, so the
 *  Logic counts are computed in a single place. */
function StartSectionBody({ section }: { section: StartSection }) {
  const trees = useSavedTrees();

  switch (section) {
    case 'start':
      return <StartHome trees={trees} />;
    case 'templates':
      return (
        <div className="flex flex-col gap-5">
          <p className="text-neutral-500 text-sm dark:text-neutral-400">
            {PATTERNS.length} curated templates — every diagram type, drawn from canonical TOC
            patterns.
          </p>
          <TemplateGallery />
        </div>
      );
    case 'allTrees':
      return (
        <TreeGallery
          trees={trees}
          emptyMessage="No trees yet — start one from the Start page or a template."
        />
      );
    case 'recent':
      return <TreeList trees={trees} emptyMessage="No trees yet." />;
    case 'needsReview':
      return (
        <TreeGallery
          trees={trees.filter((t) => t.openWarnings > 0)}
          emptyMessage="All clear — no open trees have logic reservations to review."
        />
      );
    case 'learn':
      return <LearnSection />;
    default:
      return null;
  }
}
