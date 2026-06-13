import { Search } from 'lucide-react';
import { SHORTCUT_BY_ID, shortcutToAria } from '@/domain/shortcuts';
import { useDocumentStore } from '@/store';

/**
 * Centered command/search field — the primary "find anything / run a command"
 * affordance. Looks like a search input but opens the ⌘K command palette (the
 * existing surface), with a visible keyboard hint. Lives in the top bar's centre
 * zone so it reads as the chrome's focal point, matching the redesign mockup.
 */
export function CommandSearch() {
  const togglePalette = useDocumentStore((s) => s.togglePalette);
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  const cmdKey = isMac ? '⌘' : 'Ctrl';
  const paletteAria = shortcutToAria(SHORTCUT_BY_ID.palette?.keys ?? '');

  return (
    <button
      type="button"
      onClick={togglePalette}
      aria-keyshortcuts={paletteAria}
      aria-label="Search or run a command"
      title={`Search or run a command  ${cmdKey}+K`}
      // Hidden below `lg` (content-priority responsive collapse from the
      // redesign mockup): on narrower viewports the centre search field gives
      // up its space first so the title + right-hand action clusters never wrap
      // or scroll. The ⌘K palette stays fully reachable via the shortcut and
      // the TopBar overflow ▾ at every width.
      className="pointer-events-auto hidden w-full max-w-md items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-neutral-500 text-xs transition hover:border-neutral-300 hover:bg-neutral-50 lg:flex dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400 dark:hover:border-neutral-700"
    >
      <Search className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="flex-1 truncate text-left">Search or run a command…</span>
      <kbd className="hidden shrink-0 rounded-sm border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[10px] text-neutral-500 sm:inline dark:border-neutral-800 dark:bg-neutral-900">
        {cmdKey}+K
      </kbd>
    </button>
  );
}
