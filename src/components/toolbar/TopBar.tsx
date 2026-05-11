import { useDocumentStore } from '@/store';
import { HelpCircle, Moon, Search, Sun } from 'lucide-react';
import { Button } from '../ui/Button';

export function TopBar() {
  const togglePalette = useDocumentStore((s) => s.togglePalette);
  const toggleTheme = useDocumentStore((s) => s.toggleTheme);
  const openHelp = useDocumentStore((s) => s.openHelp);
  const theme = useDocumentStore((s) => s.theme);

  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  const cmdKey = isMac ? '⌘' : 'Ctrl';

  return (
    <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
      <Button
        variant="softNeutral"
        onClick={togglePalette}
        className="pointer-events-auto"
        title={`${cmdKey}+K`}
      >
        <Search className="h-3.5 w-3.5" />
        <span>Commands</span>
        <kbd className="ml-1 rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[10px] text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
          {cmdKey}+K
        </kbd>
      </Button>
      <Button
        variant="softNeutral"
        size="icon"
        onClick={openHelp}
        className="pointer-events-auto"
        aria-label="Keyboard shortcuts"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="softNeutral"
        size="icon"
        onClick={toggleTheme}
        className="pointer-events-auto"
        aria-label="Toggle dark mode"
      >
        {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}
