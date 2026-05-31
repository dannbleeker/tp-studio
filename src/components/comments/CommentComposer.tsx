import { MessageSquarePlus } from 'lucide-react';
import { useState } from 'react';
import type { CommentAnchor } from '@/domain/types';
import { Button } from '../ui/Button';
import type { AnchorDescription } from './anchors';

/**
 * The "write a new comment" box at the top of the panel. The anchor is
 * derived from the current canvas selection (a single entity/edge → that
 * target; otherwise the whole diagram). When something is selected the
 * user can still opt to file a general document-level comment instead via
 * the checkbox. Cmd/Ctrl+Enter submits.
 *
 * Identity is local-only: the author's name is a free-text preference
 * edited right here so it's discoverable without a Settings detour.
 * Blank → comments are stamped "Anonymous" by the store.
 */
export function CommentComposer({
  anchor,
  anchorDesc,
  authorName,
  onAuthorNameChange,
  onSubmit,
}: {
  anchor: CommentAnchor;
  anchorDesc: AnchorDescription;
  authorName: string;
  onAuthorNameChange: (name: string) => void;
  onSubmit: (anchor: CommentAnchor, body: string) => void;
}) {
  const [body, setBody] = useState('');
  const [toDocument, setToDocument] = useState(false);

  const isAnchored = anchor.kind !== 'document';
  const effectiveAnchor: CommentAnchor = toDocument ? { kind: 'document' } : anchor;
  const targetText = toDocument ? 'Whole diagram' : anchorDesc.text;

  const submit = () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    onSubmit(effectiveAnchor, trimmed);
    setBody('');
    setToDocument(false);
  };

  return (
    <div className="border-neutral-200 border-b px-4 py-3 dark:border-neutral-800">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
        <span className="shrink-0">Signing as</span>
        <input
          type="text"
          value={authorName}
          placeholder="your name"
          onChange={(e) => onAuthorNameChange(e.target.value)}
          aria-label="Your name for comments"
          className="w-32 rounded-sm border border-neutral-200 bg-white px-1.5 py-0.5 text-neutral-700 outline-hidden focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
        />
      </div>

      <p className="mb-1 text-[11px] text-neutral-500 dark:text-neutral-400">
        Commenting on{' '}
        <span className="font-semibold text-neutral-700 dark:text-neutral-200">{targetText}</span>
      </p>

      <textarea
        value={body}
        rows={3}
        placeholder="Add a review comment…  (Cmd/Ctrl+Enter to post)"
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            submit();
          }
        }}
        className="w-full resize-y rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-sm outline-hidden focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 dark:border-neutral-800 dark:bg-neutral-900"
      />

      <div className="mt-2 flex items-center justify-between gap-2">
        {isAnchored ? (
          <label className="flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
            <input
              type="checkbox"
              checked={toDocument}
              onChange={(e) => setToDocument(e.target.checked)}
              className="accent-indigo-500"
            />
            Comment on whole diagram instead
          </label>
        ) : (
          <span />
        )}
        <Button variant="primary" size="sm" onClick={submit} disabled={body.trim().length === 0}>
          <MessageSquarePlus className="h-3.5 w-3.5" />
          Comment
        </Button>
      </div>
    </div>
  );
}
