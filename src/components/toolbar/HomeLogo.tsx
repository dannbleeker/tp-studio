import { GitBranch } from 'lucide-react';
import { useDocumentStore } from '@/store';

/**
 * Home / brand mark at the far left of the top bar. A dark rounded square that
 * opens the Start (workspace) surface — the conventional "logo goes home"
 * affordance. (About TP Studio moved to ⌘K → "About TP Studio…" and the Help
 * dialog footer when the Start page took over the logo in Session 183.)
 */
export function HomeLogo() {
  const openStart = useDocumentStore((s) => s.openStart);
  return (
    <button
      type="button"
      onClick={() => openStart('start')}
      title="Home — TP Studio workspace"
      aria-label="Home — TP Studio workspace"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-neutral-900 text-white transition hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
    >
      <GitBranch className="h-4 w-4" />
    </button>
  );
}
