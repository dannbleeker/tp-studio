import { ancestorChain } from '@/domain/groups';
import { useDocumentStore } from '@/store';
import clsx from 'clsx';
import { ChevronRight, X } from 'lucide-react';

/**
 * Slim breadcrumb shown at the top of the canvas while hoisted. Click any
 * segment to unhoist to that level. The X button on the right exits hoist
 * entirely (back to document root).
 *
 * Renders nothing when no hoist is active. Designed not to compete with the
 * top-left title or top-right toolbar — slotted between them.
 */
export function Breadcrumb() {
  const hoistedGroupId = useDocumentStore((s) => s.hoistedGroupId);
  const doc = useDocumentStore((s) => s.doc);
  const hoistGroup = useDocumentStore((s) => s.hoistGroup);
  const unhoist = useDocumentStore((s) => s.unhoist);

  if (!hoistedGroupId) return null;
  const target = doc.groups[hoistedGroupId];
  if (!target) return null;

  // The ancestor chain is from direct-parent up; we want top-down for display.
  const ancestors = ancestorChain(doc, hoistedGroupId).slice().reverse();
  const chain = [...ancestors, target];

  return (
    <div
      data-component="breadcrumb"
      className="-translate-x-1/2 pointer-events-auto absolute top-4 left-1/2 z-10 flex items-center gap-1 rounded-full border border-neutral-200 bg-white/95 px-3 py-1 text-xs shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95"
    >
      <button
        type="button"
        onClick={unhoist}
        className="rounded px-1.5 py-0.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
        title="Exit hoist (Esc)"
      >
        {doc.title || 'Document'}
      </button>
      {chain.map((g, i) => {
        const isLast = i === chain.length - 1;
        return (
          <span key={g.id} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 text-neutral-400" />
            <button
              type="button"
              onClick={() => (isLast ? undefined : hoistGroup(g.id))}
              disabled={isLast}
              className={clsx(
                'rounded px-1.5 py-0.5 transition',
                isLast
                  ? 'cursor-default font-semibold text-neutral-900 dark:text-neutral-100'
                  : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100'
              )}
            >
              {g.title || 'Untitled group'}
            </button>
          </span>
        );
      })}
      <button
        type="button"
        onClick={unhoist}
        className="ml-1 rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
        aria-label="Exit hoist"
        title="Exit hoist (Esc)"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
