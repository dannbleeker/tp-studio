import { DataComponent } from '@/components/dataComponentNames';
import { useDocumentStore } from '@/store';
import clsx from 'clsx';
import { X } from 'lucide-react';

/**
 * FL-EX8 — multi-document workspace tab bar (v0, in-memory).
 *
 * Shows one chip per open tab; click switches, the X closes. Hidden
 * when only one tab exists so the single-document UI looks exactly
 * the same as before — the bar appears the moment the user opens
 * their second tab via the **New tab…** palette command.
 *
 * Layout: sits at `top-12 left-4`, just below the TitleBadge that
 * lives at `top-4 left-4`. The TitleBadge always shows the **active**
 * tab's title, so the tab bar is purely a switcher, not an editor.
 *
 * v0 limitations called out in the slice header:
 *   - tabs are in-memory only; reload reverts to single-doc
 *   - no drag-to-reorder
 *   - no keyboard shortcut to switch (planned: Ctrl+Tab / Ctrl+Shift+Tab)
 *
 * These are the gaps that distinguish "feel it out" from "ship it";
 * if the user likes v0 we'll cover them in the follow-up.
 */
export function TabBar() {
  const tabs = useDocumentStore((s) => s.workspace.tabs);
  const activeTabId = useDocumentStore((s) => s.workspace.activeTabId);
  const switchTab = useDocumentStore((s) => s.switchTab);
  const closeTab = useDocumentStore((s) => s.closeTab);

  // Hidden when only one tab is open — keeps the canvas chrome clean
  // for single-doc users who never venture into multi-tab territory.
  if (tabs.length <= 1) return null;

  return (
    <div
      data-component={DataComponent.TabBar}
      // top-12 puts the bar just under the TitleBadge at top-4 (which
      // is ~32 px tall with its padding). z-10 matches TitleBadge /
      // TopBar; pointer-events-auto on the chips lets clicks through
      // even though the outer container is positioned over the canvas.
      className="pointer-events-none absolute top-12 left-4 z-10 flex max-w-[calc(100%-2rem)] flex-wrap items-center gap-1"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const displayTitle = tab.title.trim() === '' ? 'Untitled' : tab.title;
        return (
          <div
            key={tab.id}
            className={clsx(
              'pointer-events-auto inline-flex max-w-[20ch] items-center gap-1 rounded-md border px-2 py-1 text-xs transition',
              isActive
                ? 'border-indigo-300 bg-white text-indigo-900 shadow-sm dark:border-indigo-700/60 dark:bg-neutral-900 dark:text-indigo-200'
                : 'border-neutral-200 bg-neutral-50/80 text-neutral-600 hover:bg-white hover:text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100'
            )}
          >
            <button
              type="button"
              onClick={() => switchTab(tab.id)}
              className="min-w-0 truncate"
              title={displayTitle}
              aria-current={isActive ? 'page' : undefined}
            >
              {displayTitle}
            </button>
            {/* X only renders when there's more than one tab. The slice
                also guards `closeTab` against closing the last tab, so
                this is belt + braces. */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              className="shrink-0 rounded p-0.5 text-neutral-400 transition hover:bg-neutral-200 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
              aria-label={`Close ${displayTitle}`}
              title={`Close ${displayTitle}`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
