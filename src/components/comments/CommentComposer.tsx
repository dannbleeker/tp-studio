import { MessageSquarePlus } from 'lucide-react';
import { useState } from 'react';
import { CLR_CATEGORIES, CLR_CATEGORY_LABELS, type ClrCategory } from '@/domain/clrCategory';
import type { CommentAnchor } from '@/domain/types';
import { useDocumentStore } from '@/store';
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
  onSubmit: (anchor: CommentAnchor, body: string, clrCategory?: ClrCategory) => void;
}) {
  const [body, setBody] = useState('');
  const [toDocument, setToDocument] = useState(false);
  // Session 179 (Theme C) — optional CLR category for this comment. '' = none.
  const [clrCategory, setClrCategory] = useState<ClrCategory | ''>('');

  // Session 180 / E6 — challenge mode: when the user is in Reader mode and has
  // clicked "Challenge?" on an edge, we surface a focused UX: the heading
  // becomes "What's your reservation about this arrow?", and the CLR picker
  // is promoted above the textarea so the trainee names their objection type
  // before writing prose. No new prop — we derive it entirely from store state.
  const pendingAnchor = useDocumentStore((s) => s.pendingCommentAnchor);
  const isReaderMode = useDocumentStore((s) => s.appMode === 'reader');
  const challengeMode = isReaderMode && pendingAnchor?.kind === 'edge';

  const isAnchored = anchor.kind !== 'document';
  const effectiveAnchor: CommentAnchor = toDocument ? { kind: 'document' } : anchor;
  const targetText = toDocument ? 'Whole diagram' : anchorDesc.text;

  const submit = () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    onSubmit(effectiveAnchor, trimmed, clrCategory || undefined);
    setBody('');
    setToDocument(false);
    setClrCategory('');
  };

  /** CLR reservation select — shared by both normal and challenge layouts. */
  const clrSelect = (
    <label className="flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
      <span className="shrink-0">CLR reservation</span>
      <select
        value={clrCategory}
        onChange={(e) => setClrCategory(e.target.value as ClrCategory | '')}
        aria-label="Category of Legitimate Reservation"
        className="flex-1 rounded-sm border border-neutral-200 bg-white px-1.5 py-0.5 text-neutral-700 outline-hidden focus:border-accent-400 focus:ring-1 focus:ring-accent-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
      >
        <option value="">None</option>
        {CLR_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {CLR_CATEGORY_LABELS[c]}
          </option>
        ))}
      </select>
    </label>
  );

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
          className="w-32 rounded-sm border border-neutral-200 bg-white px-1.5 py-0.5 text-neutral-700 outline-hidden focus:border-accent-400 focus:ring-1 focus:ring-accent-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
        />
      </div>

      {/* Session 180 / E6 — challenge mode heading (reader + edge anchor) */}
      {challengeMode ? (
        <p className="mb-2 font-semibold text-accent-700 text-sm dark:text-accent-400">
          What's your reservation about this arrow?
        </p>
      ) : (
        <p className="mb-1 text-[11px] text-neutral-500 dark:text-neutral-400">
          Commenting on{' '}
          <span className="font-semibold text-neutral-700 dark:text-neutral-200">{targetText}</span>
        </p>
      )}

      {/* In challenge mode the CLR picker comes first so the trainee names
          the type of objection before writing prose. */}
      {challengeMode && (
        <div className="mb-2">
          {clrSelect}
          <p className="mt-1 text-[11px] text-neutral-400 dark:text-neutral-500">
            Naming the category helps the diagram author respond to your specific concern.
          </p>
        </div>
      )}

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
        className="w-full resize-y rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-sm outline-hidden focus:border-accent-400 focus:ring-1 focus:ring-accent-400 dark:border-neutral-800 dark:bg-neutral-900"
      />

      {/* CLR reservation tag — turns the comment into a named "I have a
          <category> reservation" objection (the non-threatening disagreement
          protocol). Optional; defaults to none. Hidden in challenge mode
          because the picker already appeared above the textarea. */}
      {!challengeMode && <div className="mt-2">{clrSelect}</div>}

      <div className="mt-2 flex items-center justify-between gap-2">
        {isAnchored && !challengeMode ? (
          <label className="flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
            <input
              type="checkbox"
              checked={toDocument}
              onChange={(e) => setToDocument(e.target.checked)}
              className="accent-accent-500"
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
