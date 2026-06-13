import { formatRelativeTime } from '@/components/history/formatTime';
import type { DocumentId, TPDocument } from '@/domain/types';
import { useDocumentStore } from '@/store';
import { DocumentThumbnail } from '@/templates/thumbnail';
import { diagramMetaFor } from './diagramMeta';
import { LogicPill } from './LogicPill';

/**
 * Session 183 — a tree card: a mini live-document preview, the title, the
 * diagram type + relative edited-time, and a Logic-status pill. Clicking
 * switches to that tab (which clears `startSection`, dropping into the editor
 * on the chosen tree).
 */
export function TreeCard({
  id,
  doc,
  openWarnings,
}: {
  id: DocumentId;
  doc: TPDocument;
  openWarnings: number;
}) {
  const switchTab = useDocumentStore((s) => s.switchTab);
  const meta = diagramMetaFor(doc.diagramType);
  const Icon = meta.icon;
  const title = doc.title?.trim() || 'Untitled';

  return (
    <button
      type="button"
      onClick={() => switchTab(id)}
      aria-label={`Open tree: ${title}`}
      className="group flex h-full w-full flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white text-left transition hover:border-indigo-400 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-indigo-500"
    >
      <div className="aspect-[5/3] w-full overflow-hidden border-neutral-200 border-b bg-neutral-50 [&>svg]:h-full [&>svg]:w-full dark:border-neutral-800 dark:bg-neutral-950">
        <DocumentThumbnail doc={doc} />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h4 className="truncate font-medium text-neutral-900 text-sm dark:text-neutral-100">
          {title}
        </h4>
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1 text-[11px] text-neutral-500 dark:text-neutral-400">
            <Icon className="h-3 w-3 shrink-0" style={{ color: meta.color }} aria-hidden />
            <span className="truncate">
              {meta.tag} · {formatRelativeTime(doc.updatedAt)}
            </span>
          </span>
          <LogicPill openWarnings={openWarnings} />
        </div>
      </div>
    </button>
  );
}
