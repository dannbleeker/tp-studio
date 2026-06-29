import clsx from 'clsx';
import { CheckCircle2, CornerDownRight, MapPin, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { CLR_CATEGORY_LABELS } from '@/domain/clrCategory';
import type { Comment } from '@/domain/types';
import { formatRelativeTime } from '../history/formatTime';
import { Button } from '../ui/Button';

/**
 * One review thread: a top-level comment, its (one-level-deep) replies,
 * and the thread-level actions (reply / resolve / jump-to-anchor). Each
 * comment renders through {@link CommentItem}, which owns its own
 * edit-in-place state. Bodies are plain text — React escapes them, so a
 * comment like `<script>` shows literally rather than executing.
 */
export function CommentThread({
  top,
  replies,
  anchorText,
  anchorMissing,
  onJump,
  onReply,
  onEdit,
  onDelete,
  onResolve,
}: {
  top: Comment;
  replies: Comment[];
  anchorText: string;
  anchorMissing: boolean;
  onJump: () => void;
  onReply: (parentId: string, body: string) => void;
  onEdit: (id: string, body: string) => void;
  onDelete: (id: string) => void;
  onResolve: (id: string, resolved: boolean) => void;
}) {
  const [replying, setReplying] = useState(false);
  const resolved = top.resolved === true;

  return (
    <li className={clsx('px-4 py-3', resolved && 'bg-neutral-50/60 dark:bg-neutral-900/40')}>
      <button
        type="button"
        onClick={onJump}
        disabled={anchorMissing}
        title={anchorMissing ? undefined : 'Select this on the canvas'}
        className={clsx(
          'mb-2 inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 font-semibold text-[10px] uppercase tracking-wider',
          anchorMissing
            ? 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500'
            : 'bg-accent-50 text-accent-600 hover:bg-accent-100 dark:bg-accent-950/50 dark:text-accent-300 dark:hover:bg-accent-900/50'
        )}
      >
        <MapPin className="h-3 w-3 shrink-0" />
        <span className="truncate normal-case tracking-normal">{anchorText}</span>
      </button>

      <div className={clsx(resolved && 'opacity-60')}>
        <CommentItem comment={top} onEdit={onEdit} onDelete={onDelete} />

        {replies.length > 0 && (
          <ul className="mt-2 space-y-2 border-neutral-200 border-l pl-3 dark:border-neutral-800">
            {replies.map((r) => (
              <li key={r.id}>
                <CommentItem comment={r} onEdit={onEdit} onDelete={onDelete} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-2 flex items-center gap-1">
        <Button variant="ghost" size="xs" onClick={() => setReplying((v) => !v)}>
          <CornerDownRight className="h-3 w-3" />
          Reply
        </Button>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => onResolve(top.id, !resolved)}
          className={resolved ? undefined : 'text-emerald-600 dark:text-emerald-400'}
        >
          {resolved ? (
            <>
              <RotateCcw className="h-3 w-3" />
              Reopen
            </>
          ) : (
            <>
              <CheckCircle2 className="h-3 w-3" />
              Resolve
            </>
          )}
        </Button>
      </div>

      {replying && (
        <ReplyBox
          onCancel={() => setReplying(false)}
          onSubmit={(body) => {
            onReply(top.id, body);
            setReplying(false);
          }}
        />
      )}
    </li>
  );
}

/**
 * A single comment row — author, relative time, body — with inline
 * edit + delete. Used for both the top-level comment and each reply.
 */
function CommentItem({
  comment,
  onEdit,
  onDelete,
}: {
  comment: Comment;
  onEdit: (id: string, body: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);

  if (editing) {
    const save = () => {
      const trimmed = draft.trim();
      if (trimmed) onEdit(comment.id, trimmed);
      setEditing(false);
    };
    return (
      <div>
        <textarea
          value={draft}
          rows={3}
          // biome-ignore lint/a11y/noAutofocus: focus belongs on the field the user just chose to edit
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              save();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setDraft(comment.body);
              setEditing(false);
            }
          }}
          className="w-full resize-y rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-sm outline-hidden focus:border-accent-400 focus:ring-1 focus:ring-accent-400 dark:border-neutral-800 dark:bg-neutral-900"
        />
        <div className="mt-1 flex items-center gap-1">
          <Button variant="primary" size="xs" onClick={save} disabled={draft.trim().length === 0}>
            Save
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              setDraft(comment.body);
              setEditing(false);
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate font-medium text-neutral-700 text-xs dark:text-neutral-200">
          {comment.author}
        </span>
        <span className="shrink-0 text-[10px] text-neutral-400 tabular-nums dark:text-neutral-500">
          {formatRelativeTime(comment.createdAt)}
        </span>
      </div>
      <p className="mt-0.5 whitespace-pre-wrap break-words text-neutral-700 text-sm dark:text-neutral-200">
        {comment.body}
      </p>
      {comment.clrCategory && (
        <span
          className="mt-1 inline-block rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 font-medium text-[10px] text-amber-700 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
          title="Category of Legitimate Reservation raised by this comment"
        >
          {CLR_CATEGORY_LABELS[comment.clrCategory]} reservation
        </span>
      )}
      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-neutral-400 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100">
        <button
          type="button"
          onClick={() => {
            setDraft(comment.body);
            setEditing(true);
          }}
          className="hover:text-neutral-700 dark:hover:text-neutral-200"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => onDelete(comment.id)}
          className="hover:text-red-600 dark:hover:text-red-400"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

/** Inline reply textarea shown under a thread when "Reply" is toggled. */
function ReplyBox({
  onSubmit,
  onCancel,
}: {
  onSubmit: (body: string) => void;
  onCancel: () => void;
}) {
  const [body, setBody] = useState('');
  const submit = () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  };
  return (
    <div className="mt-2 border-neutral-200 border-l pl-3 dark:border-neutral-800">
      <textarea
        value={body}
        rows={2}
        placeholder="Reply…  (Cmd/Ctrl+Enter to post)"
        // biome-ignore lint/a11y/noAutofocus: the reply box only mounts on an explicit Reply click
        autoFocus
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            submit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
        className="w-full resize-y rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-sm outline-hidden focus:border-accent-400 focus:ring-1 focus:ring-accent-400 dark:border-neutral-800 dark:bg-neutral-900"
      />
      <div className="mt-1 flex items-center gap-1">
        <Button variant="primary" size="xs" onClick={submit} disabled={body.trim().length === 0}>
          Reply
        </Button>
        <Button variant="ghost" size="xs" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
