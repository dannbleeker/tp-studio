import { GitBranch } from 'lucide-react';
import { useDocumentStore } from '@/store';

/**
 * Home / brand mark at the far left of the top bar. A dark rounded square that
 * opens the About dialog (app identity, version, licenses). Keeps the chrome's
 * left edge anchored the way the redesign mockup shows.
 */
export function HomeLogo() {
  const openAbout = useDocumentStore((s) => s.openAbout);
  return (
    <button
      type="button"
      onClick={openAbout}
      title="About TP Studio"
      aria-label="About TP Studio"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-neutral-900 text-white transition hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
    >
      <GitBranch className="h-4 w-4" />
    </button>
  );
}
