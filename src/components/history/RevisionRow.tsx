import { computeRevisionDiff, summarizeRevisionDiff } from '@/domain/revisions';
import type { Revision } from '@/domain/revisions';
import clsx from 'clsx';
import { Columns2, Eye, GitBranch, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { formatRelativeTime } from './formatTime';

/**
 * One snapshot row in the RevisionPanel list. Pure presentation —
 * receives all callbacks as props so the parent owns store wiring and
 * this component stays simple to unit-test.
 *
 * The 6 affordances (compare-overlay, side-by-side, branch, rename,
 * restore, delete) all live as small icon buttons in the row's right
 * gutter. Rename swaps the title into an inline `<input>` that commits
 * on Enter or blur; Esc cancels.
 */

export type RevisionRowProps = {
  revision: Revision;
  liveDoc: Parameters<typeof computeRevisionDiff>[0];
  recent: boolean;
  comparing: boolean;
  onRestore: () => void;
  onDelete: () => void;
  onRename: (label: string) => void;
  onCompare: () => void;
  onSideBySide: () => void;
  onBranch: () => void;
};

export function RevisionRow({
  revision,
  liveDoc,
  recent,
  comparing,
  onRestore,
  onDelete,
  onRename,
  onCompare,
  onSideBySide,
  onBranch,
}: RevisionRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(revision.label ?? '');

  // Diff *to* the live doc, framed as "go from this revision to current."
  // The summary string reads as "what's changed since this snapshot."
  const diff = computeRevisionDiff(revision.doc, liveDoc);
  const summary = summarizeRevisionDiff(diff);

  return (
    <li
      className={clsx(
        'px-4 py-3 transition-colors',
        recent && 'bg-violet-50/50 dark:bg-violet-950/30',
        comparing && 'bg-indigo-50/60 dark:bg-indigo-950/30'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => {
                onRename(draft);
                setEditing(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onRename(draft);
                  setEditing(false);
                } else if (e.key === 'Escape') {
                  setDraft(revision.label ?? '');
                  setEditing(false);
                }
              }}
              placeholder="Label this snapshot…"
              // biome-ignore lint/a11y/noAutofocus: opt-in inline rename — the user just clicked the pencil and expects to type immediately.
              autoFocus
              className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm text-neutral-900 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
            />
          ) : (
            <p className="truncate text-sm font-medium text-neutral-800 dark:text-neutral-200">
              {revision.label ?? (
                <span className="italic text-neutral-500">Unlabelled snapshot</span>
              )}
            </p>
          )}
          <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
            {formatRelativeTime(revision.capturedAt)} · {summary}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={onCompare}
            className={clsx(
              'rounded p-1 transition',
              comparing
                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200'
                : 'text-neutral-400 hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-200'
            )}
            aria-label="Visual diff (overlay)"
            title="Visual diff (overlay live canvas)"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onSideBySide}
            className="rounded p-1 text-neutral-400 transition hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-200"
            aria-label="Side-by-side compare"
            title="Side-by-side compare"
          >
            <Columns2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onBranch}
            className="rounded p-1 text-neutral-400 transition hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-200"
            aria-label="Branch from snapshot"
            title="Branch from here (label a fork)"
          >
            <GitBranch className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(revision.label ?? '');
              setEditing((v) => !v);
            }}
            className="rounded p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            aria-label="Rename snapshot"
            title="Rename"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onRestore}
            className="rounded p-1 text-neutral-400 transition hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-200"
            aria-label="Restore snapshot"
            title="Restore"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded p-1 text-neutral-400 transition hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40 dark:hover:text-rose-200"
            aria-label="Delete snapshot"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </li>
  );
}
