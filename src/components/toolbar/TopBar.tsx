import { HelpCircle, Moon, Search, Sun } from 'lucide-react';
import { useDocumentStore } from '../../store';

export function TopBar() {
  const togglePalette = useDocumentStore((s) => s.togglePalette);
  const toggleTheme = useDocumentStore((s) => s.toggleTheme);
  const openHelp = useDocumentStore((s) => s.openHelp);
  const theme = useDocumentStore((s) => s.theme);

  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  const cmdKey = isMac ? '⌘' : 'Ctrl';

  return (
    <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
      <button
        type="button"
        onClick={togglePalette}
        className="pointer-events-auto inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-white/90 px-2.5 py-1.5 text-xs font-medium text-neutral-600 shadow-sm transition hover:bg-white hover:text-neutral-900 dark:border-neutral-800 dark:bg-neutral-950/90 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
        title={`${cmdKey}+K`}
      >
        <Search className="h-3.5 w-3.5" />
        <span>Commands</span>
        <kbd className="ml-1 rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[10px] text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
          {cmdKey}+K
        </kbd>
      </button>
      <button
        type="button"
        onClick={openHelp}
        className="pointer-events-auto rounded-md border border-neutral-200 bg-white/90 p-1.5 text-neutral-600 shadow-sm transition hover:bg-white hover:text-neutral-900 dark:border-neutral-800 dark:bg-neutral-950/90 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
        aria-label="Keyboard shortcuts"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={toggleTheme}
        className="pointer-events-auto rounded-md border border-neutral-200 bg-white/90 p-1.5 text-neutral-600 shadow-sm transition hover:bg-white hover:text-neutral-900 dark:border-neutral-800 dark:bg-neutral-950/90 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
        aria-label="Toggle dark mode"
      >
        {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
