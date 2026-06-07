import { nanoid } from 'nanoid';
import type { StateCreator } from 'zustand';
import type { ClrCategory } from '@/domain/clrCategory';
import type { Comment, CommentAnchor } from '@/domain/types';
import { currentDoc } from '../selectors';
import type { RootStore } from '../types';
import { makeApplyDocChange, touch } from './docMutate';

/**
 * Review-comment actions. Comments live in `doc.comments` (so they round-trip
 * through JSON export / share-links / persistence) and mutate through
 * `applyDocChange` — every action is therefore undoable, persisted, and part
 * of history. Threads are FLAT and one level deep: a reply carries the
 * top-level comment's id as `parentId`. `resolved` is a thread-level flag kept
 * on the top-level comment.
 */
export type CommentsSlice = {
  /** Add a top-level comment on an anchor, optionally tagged with a CLR
   *  category. Returns the comment, or null when the body is empty. */
  addComment: (anchor: CommentAnchor, body: string, clrCategory?: ClrCategory) => Comment | null;
  /** Reply to a comment. Replies attach to the same anchor as their thread
   *  and re-target the top-level parent (one level deep). Null on empty body
   *  or unknown parent. */
  replyToComment: (parentId: string, body: string) => Comment | null;
  editComment: (id: string, body: string) => void;
  deleteComment: (id: string) => void;
  /** Resolve / re-open a thread (applied to the top-level comment). */
  resolveComment: (id: string, resolved: boolean) => void;
};

export const createCommentsSlice: StateCreator<RootStore, [], [], CommentsSlice> = (set, get) => {
  const applyDocChange = makeApplyDocChange(get, set);

  const mint = (
    anchor: CommentAnchor,
    body: string,
    parentId?: string,
    clrCategory?: ClrCategory
  ): Comment => {
    const now = Date.now();
    return {
      id: `cmt-${nanoid(10)}`,
      anchor,
      body,
      // Local display name from preferences; neutral fallback when unset.
      author: get().commentAuthorName.trim() || 'Anonymous',
      ...(parentId ? { parentId } : {}),
      ...(clrCategory ? { clrCategory } : {}),
      createdAt: now,
      updatedAt: now,
    };
  };

  const insert = (comment: Comment): void => {
    applyDocChange((prev) =>
      touch({ ...prev, comments: { ...(prev.comments ?? {}), [comment.id]: comment } })
    );
  };

  return {
    addComment: (anchor, body, clrCategory) => {
      const text = body.trim();
      if (text.length === 0) return null;
      const comment = mint(anchor, text, undefined, clrCategory);
      insert(comment);
      return comment;
    },

    replyToComment: (parentId, body) => {
      const text = body.trim();
      if (text.length === 0) return null;
      const parent = currentDoc(get()).comments?.[parentId];
      if (!parent) return null;
      // Replying to a reply re-targets the top-level comment so threads stay
      // one level deep.
      const topId = parent.parentId ?? parentId;
      const reply = mint(parent.anchor, text, topId);
      insert(reply);
      return reply;
    },

    editComment: (id, body) => {
      const text = body.trim();
      applyDocChange((prev) => {
        const cur = prev.comments?.[id];
        if (!cur || text.length === 0 || cur.body === text) return prev;
        const next: Comment = { ...cur, body: text, updatedAt: Date.now() };
        return touch({ ...prev, comments: { ...prev.comments, [id]: next } });
      });
    },

    deleteComment: (id) => {
      applyDocChange((prev) => {
        if (!prev.comments?.[id]) return prev;
        const next: Record<string, Comment> = {};
        for (const [cid, c] of Object.entries(prev.comments)) {
          // Drop the target AND any replies to it — deleting a thread takes
          // its replies with it.
          if (cid === id || c.parentId === id) continue;
          next[cid] = c;
        }
        return touch({ ...prev, comments: next });
      });
    },

    resolveComment: (id, resolved) => {
      applyDocChange((prev) => {
        const cur = prev.comments?.[id];
        if (!cur) return prev;
        const topId = cur.parentId ?? id;
        const top = prev.comments?.[topId];
        if (!top || Boolean(top.resolved) === resolved) return prev;
        // emit-or-omit: store `resolved: true`, drop the field when re-opening.
        const { resolved: _drop, ...rest } = top;
        const next: Comment = resolved
          ? { ...rest, resolved: true, updatedAt: Date.now() }
          : { ...rest, updatedAt: Date.now() };
        return touch({ ...prev, comments: { ...prev.comments, [topId]: next } });
      });
    },
  };
};
