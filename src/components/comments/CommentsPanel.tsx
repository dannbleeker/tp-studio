import clsx from 'clsx';
import { MessageSquare, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/shallow';
import type { Comment, CommentAnchor } from '@/domain/types';
import { getCanvasInstance } from '@/services/canvasRef';
import { useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';
import { Button } from '../ui/Button';
import { anchorFromSelection, describeAnchor } from './anchors';
import { CommentComposer } from './CommentComposer';
import { CommentThread } from './CommentThread';

type Filter = 'open' | 'resolved' | 'all';

/**
 * Review-comments side panel. Slides in from the right (sharing the slot
 * with the inspector + history panel, sitting one z-layer above them so an
 * anchored entity can stay selected underneath). Lists every thread in the
 * document, oldest-first within the chosen Open / Resolved / All filter,
 * with a composer on top and per-thread reply / resolve / jump actions.
 */
export function CommentsPanel() {
  const {
    open,
    close,
    doc,
    selection,
    addComment,
    replyToComment,
    editComment,
    deleteComment,
    resolveComment,
    selectEntity,
    selectEdge,
    authorName,
    setAuthorName,
    confirm,
  } = useDocumentStore(
    useShallow((s) => ({
      open: s.commentsPanelOpen,
      close: s.closeCommentsPanel,
      doc: currentDoc(s),
      selection: s.selection,
      addComment: s.addComment,
      replyToComment: s.replyToComment,
      editComment: s.editComment,
      deleteComment: s.deleteComment,
      resolveComment: s.resolveComment,
      selectEntity: s.selectEntity,
      selectEdge: s.selectEdge,
      authorName: s.commentAuthorName,
      setAuthorName: s.setCommentAuthorName,
      confirm: s.confirm,
    }))
  );

  const [filter, setFilter] = useState<Filter>('open');

  const comments = useMemo(() => doc.comments ?? {}, [doc.comments]);

  // Split into top-level threads + a parent→replies index. Replies read
  // oldest-first (conversation order); threads newest-first (recent
  // discussion floats up).
  const { threads, repliesByParent, openCount, resolvedCount } = useMemo(() => {
    const all = Object.values(comments);
    const tops: Comment[] = [];
    const byParent = new Map<string, Comment[]>();
    for (const c of all) {
      if (c.parentId) {
        const list = byParent.get(c.parentId) ?? [];
        list.push(c);
        byParent.set(c.parentId, list);
      } else {
        tops.push(c);
      }
    }
    for (const list of byParent.values()) list.sort((a, b) => a.createdAt - b.createdAt);
    tops.sort((a, b) => b.createdAt - a.createdAt);
    const open = tops.filter((c) => c.resolved !== true).length;
    return {
      threads: tops,
      repliesByParent: byParent,
      openCount: open,
      resolvedCount: tops.length - open,
    };
  }, [comments]);

  const visibleThreads = threads.filter((c) =>
    filter === 'all' ? true : filter === 'resolved' ? c.resolved === true : c.resolved !== true
  );

  const composerAnchor = anchorFromSelection(selection);
  const composerDesc = describeAnchor(composerAnchor, doc.entities, doc.edges);

  const jumpToAnchor = (anchor: CommentAnchor) => {
    if (anchor.kind === 'entity') {
      selectEntity(anchor.entityId);
      const inst = getCanvasInstance();
      const node = inst?.getNode(anchor.entityId);
      if (node && inst) {
        // Center after a frame so the selection re-render lands first.
        window.requestAnimationFrame(() => {
          inst.setCenter(node.position.x + 140, node.position.y + 40, {
            zoom: inst.getZoom(),
            duration: 250,
          });
        });
      }
    } else if (anchor.kind === 'edge') {
      selectEdge(anchor.edgeId);
      const edge = doc.edges[anchor.edgeId];
      const inst = getCanvasInstance();
      if (edge && inst) {
        const a = inst.getNode(edge.sourceId);
        const b = inst.getNode(edge.targetId);
        if (a && b) {
          // Center between the two endpoints (+ node half-size to aim at
          // the node centers rather than their top-left corners).
          const cx = (a.position.x + b.position.x) / 2 + 140;
          const cy = (a.position.y + b.position.y) / 2 + 40;
          window.requestAnimationFrame(() => {
            inst.setCenter(cx, cy, { zoom: inst.getZoom(), duration: 250 });
          });
        }
      }
    }
    // 'document' anchors have nothing to jump to.
  };

  const handleDelete = async (id: string) => {
    const target = comments[id];
    if (!target) return;
    const hasReplies = !target.parentId && (repliesByParent.get(id)?.length ?? 0) > 0;
    if (hasReplies) {
      const ok = await confirm('Delete this comment and all of its replies?', {
        confirmLabel: 'Delete',
      });
      if (!ok) return;
    }
    deleteComment(id);
  };

  return (
    <aside
      data-component="comments-panel"
      className={clsx(
        // Mirrors the inspector/history geometry, one z-layer higher so a
        // selected entity's inspector can sit behind it.
        'absolute top-0 right-0 z-30 h-full w-[min(85vw,340px)] transform md:w-[340px]',
        'border-neutral-200 border-l bg-white/95 backdrop-blur-sm',
        'dark:border-neutral-800 dark:bg-neutral-950/95',
        'transition-transform duration-200 ease-out',
        open ? 'translate-x-0' : 'translate-x-full'
      )}
      aria-hidden={!open}
      {...({ inert: !open ? '' : undefined } as Record<string, string | undefined>)}
    >
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between border-neutral-200 border-b px-4 py-3 dark:border-neutral-800">
          <span className="flex items-center gap-2 font-semibold text-[11px] text-neutral-500 uppercase tracking-wider dark:text-neutral-400">
            <MessageSquare className="h-3.5 w-3.5" /> Comments
            {openCount > 0 && (
              <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 font-semibold text-[10px] text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                {openCount} open
              </span>
            )}
          </span>
          <Button variant="ghost" size="icon" onClick={close} aria-label="Close comments">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <CommentComposer
          anchor={composerAnchor}
          anchorDesc={composerDesc}
          authorName={authorName}
          onAuthorNameChange={setAuthorName}
          onSubmit={(anchor, body) => addComment(anchor, body)}
        />

        <div className="flex items-center gap-1 border-neutral-200 border-b px-4 py-2 dark:border-neutral-800">
          <FilterTab
            label="Open"
            count={openCount}
            active={filter === 'open'}
            onClick={() => setFilter('open')}
          />
          <FilterTab
            label="Resolved"
            count={resolvedCount}
            active={filter === 'resolved'}
            onClick={() => setFilter('resolved')}
          />
          <FilterTab
            label="All"
            count={threads.length}
            active={filter === 'all'}
            onClick={() => setFilter('all')}
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {visibleThreads.length === 0 ? (
            <p className="px-4 py-6 text-center text-neutral-500 text-xs dark:text-neutral-400">
              {threads.length === 0
                ? 'No comments yet. Select an entity or edge and write one above — or comment on the whole diagram.'
                : filter === 'open'
                  ? 'No open comments. Everything here has been resolved.'
                  : 'No resolved comments yet.'}
            </p>
          ) : (
            <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {visibleThreads.map((top) => {
                const desc = describeAnchor(top.anchor, doc.entities, doc.edges);
                return (
                  <CommentThread
                    key={top.id}
                    top={top}
                    replies={repliesByParent.get(top.id) ?? []}
                    anchorText={desc.text}
                    anchorMissing={desc.missing}
                    onJump={() => jumpToAnchor(top.anchor)}
                    onReply={replyToComment}
                    onEdit={editComment}
                    onDelete={handleDelete}
                    onResolve={resolveComment}
                  />
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );
}

function FilterTab({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        'rounded-md px-2 py-1 font-medium text-xs transition',
        active
          ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
          : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-200'
      )}
    >
      {label}
      <span className="ml-1 tabular-nums opacity-70">{count}</span>
    </button>
  );
}
