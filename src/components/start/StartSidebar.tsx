import clsx from 'clsx';
import {
  AlertCircle,
  Clock,
  FolderTree,
  GitBranch,
  GraduationCap,
  Home,
  LayoutTemplate,
  Lock,
  Plus,
} from 'lucide-react';
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { validate } from '@/domain/validators';
import { useDocumentStore } from '@/store';
import type { StartSection } from '@/store/uiSlice/types';

type LucideIcon = typeof Home;
type NavItem = { section: StartSection; label: string; icon: LucideIcon; badge?: number };

/**
 * Session 183 — the Start workspace's persistent left rail. The logo is a Home
 * affordance, "New tree" is the primary create action, and the nav list drives
 * the `startSection` view. Badges (open-tree count, needs-review count) are
 * computed from the store — never literals — so they can't drift from reality.
 */
export function StartSidebar() {
  const { startSection, setStartSection, openDiagramPicker, docs, tabOrder } = useDocumentStore(
    useShallow((s) => ({
      startSection: s.startSection,
      setStartSection: s.setStartSection,
      openDiagramPicker: s.openDiagramPicker,
      docs: s.docs,
      tabOrder: s.tabOrder,
    }))
  );

  // Open-tree count + how many have at least one unresolved CLR reservation.
  // `validate` is the same pure function the editor uses, so "needs review"
  // can't diverge from the per-tree Logic pills or the editor's Logic chip.
  const { treeCount, needsReviewCount } = useMemo(() => {
    let needs = 0;
    for (const id of tabOrder) {
      const d = docs[id];
      if (d && validate(d).some((w) => !w.resolved)) needs++;
    }
    return { treeCount: tabOrder.length, needsReviewCount: needs };
  }, [docs, tabOrder]);

  const items: NavItem[] = [
    { section: 'start', label: 'Start', icon: Home },
    { section: 'allTrees', label: 'All trees', icon: FolderTree, badge: treeCount },
    { section: 'recent', label: 'Recent', icon: Clock },
    { section: 'templates', label: 'Templates', icon: LayoutTemplate },
    { section: 'needsReview', label: 'Needs review', icon: AlertCircle, badge: needsReviewCount },
    { section: 'learn', label: 'Learn the method', icon: GraduationCap },
  ];

  return (
    <aside
      aria-label="Workspace"
      className="flex w-[228px] shrink-0 flex-col border-neutral-200 border-r bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <button
        type="button"
        onClick={() => setStartSection('start')}
        aria-label="TP Studio home"
        className="flex items-center gap-2.5 px-4 py-4 text-left transition hover:opacity-80"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900">
          <GitBranch className="h-4 w-4" aria-hidden />
        </span>
        <span className="font-semibold text-neutral-900 text-sm dark:text-neutral-100">
          TP Studio
        </span>
      </button>

      <div className="px-3">
        <button
          type="button"
          onClick={() => openDiagramPicker('new')}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-3 py-2 font-medium text-sm text-white transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          <Plus className="h-4 w-4" aria-hidden />
          New tree
        </button>
      </div>

      <nav aria-label="Sections" className="mt-3 flex flex-col gap-0.5 px-2">
        {items.map(({ section, label, icon: Icon, badge }) => {
          const active = startSection === section;
          return (
            <button
              key={section}
              type="button"
              onClick={() => setStartSection(section)}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400',
                active
                  ? 'bg-neutral-900 font-medium text-white dark:bg-neutral-100 dark:text-neutral-900'
                  : 'text-neutral-600 hover:bg-neutral-200/60 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="flex-1 text-left">{label}</span>
              {typeof badge === 'number' && badge > 0 && (
                <span
                  className={clsx(
                    'rounded-full px-1.5 py-0.5 text-[11px] tabular-nums',
                    active
                      ? 'bg-white/20 text-white dark:bg-neutral-900/20 dark:text-neutral-900'
                      : section === 'needsReview'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                        : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
                  )}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto p-3">
        <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 dark:border-neutral-800 dark:bg-neutral-950">
          <p className="flex items-center gap-1.5 font-medium text-neutral-700 text-xs dark:text-neutral-200">
            <Lock className="h-3.5 w-3.5" aria-hidden />
            Local &amp; private
          </p>
          <p className="mt-1 text-[11px] text-neutral-500 leading-relaxed dark:text-neutral-400">
            Runs in your browser. Works offline. Nothing leaves this device.
          </p>
        </div>
      </div>
    </aside>
  );
}
