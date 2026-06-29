import { Trash2 } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { formatRelativeTime } from '@/components/history/formatTime';
import type { DocumentId, TPDocument } from '@/domain/types';
import { useDocumentStore } from '@/store';
import { DocumentThumbnail } from '@/templates/thumbnail';
import { diagramMetaFor } from './diagramMeta';
import { LogicPill } from './LogicPill';

/**
 * Session 183/184 — a tree card: a mini live-document preview, the title, the
 * diagram type + relative edited-time, and a Logic-status pill. Clicking opens
 * the tree (switching to its tab if already open, else loading it back from
 * storage). A hover/focus delete button permanently removes the tree from this
 * browser (closing a tab no longer does — trees live in the library until
 * deleted).
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
  const { openSavedDoc, deleteSavedDoc, confirm } = useDocumentStore(
    useShallow((s) => ({
      openSavedDoc: s.openSavedDoc,
      deleteSavedDoc: s.deleteSavedDoc,
      confirm: s.confirm,
    }))
  );
  const meta = diagramMetaFor(doc.diagramType);
  const Icon = meta.icon;
  const title = doc.title?.trim() || 'Untitled';

  const onDelete = async (): Promise<void> => {
    const ok = await confirm(
      `Delete "${title}"? It will be permanently removed from this browser — this can't be undone.`,
      { confirmLabel: 'Delete tree' }
    );
    if (ok) deleteSavedDoc(id);
  };

  return (
    <div className="group relative h-full">
      <button
        type="button"
        onClick={() => openSavedDoc(id)}
        aria-label={`Open tree: ${title}`}
        className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white text-left transition hover:border-accent-400 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-accent-500"
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
      <button
        type="button"
        onClick={() => void onDelete()}
        aria-label={`Delete tree: ${title}`}
        title="Delete tree"
        className="absolute top-1.5 right-1.5 z-10 inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/90 text-neutral-500 opacity-0 shadow-sm backdrop-blur-sm transition hover:bg-rose-50 hover:text-rose-600 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 group-hover:opacity-100 dark:bg-neutral-900/90 dark:text-neutral-400 dark:hover:bg-rose-950/50 dark:hover:text-rose-400"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}
