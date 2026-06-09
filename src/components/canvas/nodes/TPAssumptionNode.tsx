import type { NodeProps } from '@xyflow/react';
import clsx from 'clsx';
import { HelpCircle } from 'lucide-react';
import { memo, useCallback, useEffect, useRef } from 'react';
import { useShallow } from 'zustand/shallow';
import { NODE_MIN_HEIGHT, NODE_WIDTH } from '@/domain/constants';
import { guardWriteOrToast } from '@/services/browseLock';
import { useDocumentStore } from '@/store';
import type { TPAssumptionNode as TPAssumptionNodeType } from '../edges/flow-types';
import { AnnotationBadge, CommentCountBadge } from './TPNodeBadges';

/**
 * Canvas card for a first-class assumption (record-canonical). Renders from the
 * `doc.assumptions` record rather than an entity — an assumption is an edge
 * annotation, not a causal node, so it has its own React Flow node type (`tpAssumption`)
 * and stays out of the entity-typed `TPNode`. The card is non-selectable /
 * non-draggable (set at emission); double-click edits the text in place
 * (`setAssumptionText`), mirroring the EdgeInspector's Assumption Well. No
 * connection handles — assumptions are never edge endpoints.
 *
 * Visual parity with the old synthesized rendering: white card + violet stripe +
 * HelpCircle "Assumption" header + the shared annotation / comment corner badges.
 */
const ASSUMPTION_STRIPE = '#8b5cf6'; // violet-500 — mirrors `tokens.assumption`

function TPAssumptionNodeImpl({ id, data }: NodeProps<TPAssumptionNodeType>) {
  const { assumption, openCommentCount, diffStatus } = data;
  const { isEditing, setAssumptionText, beginEditing, endEditing } = useDocumentStore(
    useShallow((s) => ({
      isEditing: s.editingEntityId === id,
      setAssumptionText: s.setAssumptionText,
      beginEditing: s.beginEditing,
      endEditing: s.endEditing,
    }))
  );
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Comments on an assumption anchor to its host edge's inspector (the
  // assumption isn't independently selectable), then open the Comments panel.
  const handleOpenComments = useCallback(() => {
    const st = useDocumentStore.getState();
    st.selectEdge(assumption.edgeId);
    st.openCommentsPanel();
  }, [assumption.edgeId]);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: double-click-to-edit mirrors TPNode; React Flow owns keyboard activation.
    <div
      data-component="tp-assumption-node"
      className={clsx(
        'group relative flex items-stretch rounded-lg border shadow-xs',
        'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900',
        diffStatus === 'added' &&
          'ring-2 ring-emerald-400/70 ring-offset-1 dark:ring-emerald-500/70',
        diffStatus === 'changed' && 'ring-2 ring-amber-400/70 ring-offset-1 dark:ring-amber-500/70'
      )}
      style={{ width: NODE_WIDTH, minHeight: NODE_MIN_HEIGHT }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (isEditing) return;
        if (!guardWriteOrToast()) return;
        beginEditing(id);
      }}
      title={!isEditing && assumption.text ? assumption.text : undefined}
    >
      {openCommentCount && openCommentCount > 0 ? (
        <CommentCountBadge count={openCommentCount} onOpen={handleOpenComments} />
      ) : null}
      {typeof assumption.annotationNumber === 'number' && (
        <AnnotationBadge annotationNumber={assumption.annotationNumber} />
      )}
      <div
        className="w-1.5 shrink-0 rounded-l-lg"
        style={{ backgroundColor: ASSUMPTION_STRIPE }}
        aria-hidden
      />
      <div className="flex flex-1 flex-col gap-1 px-3 py-2.5">
        <span className="flex items-center gap-1 font-medium text-[11px] text-neutral-500 uppercase tracking-[0.06em] dark:text-neutral-400">
          <HelpCircle
            className="h-3 w-3 shrink-0"
            style={{ color: ASSUMPTION_STRIPE }}
            aria-hidden
          />
          <span>Assumption</span>
        </span>
        {isEditing ? (
          <textarea
            ref={inputRef}
            className="resize-none border-none bg-transparent p-0 text-neutral-900 text-node leading-snug outline-hidden placeholder:text-neutral-400 dark:text-neutral-100"
            rows={2}
            defaultValue={assumption.text}
            placeholder="State the assumption…"
            onBlur={(e) => {
              const next = e.currentTarget.value.trim();
              if (next !== assumption.text) setAssumptionText(id, next);
              endEditing();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.blur();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                endEditing();
              }
              e.stopPropagation();
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="line-clamp-2 whitespace-pre-line text-neutral-900 text-node leading-snug dark:text-neutral-100">
            {assumption.text || (
              <span className="text-neutral-400 italic">Untitled — double-click to edit</span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}

export const TPAssumptionNode = memo(TPAssumptionNodeImpl);
