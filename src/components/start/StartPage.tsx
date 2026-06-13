import { Search } from 'lucide-react';
import { useDocumentStore } from '@/store';
import type { StartSection } from '@/store/uiSlice/types';
import { TEMPLATE_SPECS } from '@/templates';
import { StartHome } from './StartHome';
import { StartSidebar } from './StartSidebar';
import { TemplateGallery } from './TemplateGallery';

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
            className="flex w-full max-w-xs items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-neutral-400 text-sm transition hover:border-neutral-300 hover:text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
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

/** Per-section body. Templates is registry-driven (Stage B); the hero and tree
 *  galleries fill in over Stages C–D. */
function StartSectionBody({ section }: { section: StartSection }) {
  if (section === 'start') {
    return <StartHome />;
  }
  if (section === 'templates') {
    return (
      <div className="flex flex-col gap-5">
        <p className="text-neutral-500 text-sm dark:text-neutral-400">
          {TEMPLATE_SPECS.length} worked examples — each one checked against the method.
        </p>
        <TemplateGallery />
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-neutral-200 border-dashed px-6 py-12 text-center dark:border-neutral-800">
      <p className="font-medium text-neutral-500 text-sm dark:text-neutral-400">
        {SECTION_TITLE[section]}
      </p>
      <p className="mt-1 text-neutral-400 text-xs dark:text-neutral-500">
        This section is being built.
      </p>
    </div>
  );
}
