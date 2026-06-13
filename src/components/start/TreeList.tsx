import { formatRelativeTime } from '@/components/history/formatTime';
import { useDocumentStore } from '@/store';
import { diagramMetaFor } from './diagramMeta';
import { LogicPill } from './LogicPill';
import { TreesEmpty } from './TreeGallery';
import type { SavedTree } from './useSavedTrees';

/**
 * Session 183 — a compact one-row-per-tree list (no thumbnails), used by the
 * "Recent" section. Rows read the same `SavedTree` data as the card gallery, so
 * the Logic pills agree with everywhere else.
 */
export function TreeList({ trees, emptyMessage }: { trees: SavedTree[]; emptyMessage: string }) {
  const openSavedDoc = useDocumentStore((s) => s.openSavedDoc);
  if (trees.length === 0) return <TreesEmpty message={emptyMessage} />;
  return (
    <ul className="divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
      {trees.map(({ id, doc, openWarnings }) => {
        const meta = diagramMetaFor(doc.diagramType);
        const Icon = meta.icon;
        const title = doc.title?.trim() || 'Untitled';
        return (
          <li key={id}>
            <button
              type="button"
              onClick={() => openSavedDoc(id)}
              aria-label={`Open tree: ${title}`}
              className="flex w-full items-center gap-3 bg-white px-3 py-2.5 text-left transition hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-inset dark:bg-neutral-900 dark:hover:bg-neutral-800/60"
            >
              <Icon className="h-4 w-4 shrink-0" style={{ color: meta.color }} aria-hidden />
              <span className="min-w-0 flex-1 truncate font-medium text-neutral-900 text-sm dark:text-neutral-100">
                {title}
              </span>
              <span className="hidden shrink-0 text-[11px] text-neutral-400 sm:inline dark:text-neutral-500">
                {meta.tag} · {formatRelativeTime(doc.updatedAt)}
              </span>
              <LogicPill openWarnings={openWarnings} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
