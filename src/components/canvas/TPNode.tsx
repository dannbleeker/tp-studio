import { Handle, type NodeProps, Position } from '@xyflow/react';
import clsx from 'clsx';
import { useEffect, useRef } from 'react';
import { NODE_MIN_HEIGHT, NODE_WIDTH } from '../../domain/constants';
import { ENTITY_TYPE_META } from '../../domain/entityTypeMeta';
import { useDocumentStore } from '../../store';
import type { TPNode as TPNodeType } from './flow-types';

export function TPNode({ data, selected }: NodeProps<TPNodeType>) {
  const { entity } = data;
  const meta = ENTITY_TYPE_META[entity.type];
  const isEditing = useDocumentStore((s) => s.editingEntityId === entity.id);
  const updateEntity = useDocumentStore((s) => s.updateEntity);
  const endEditing = useDocumentStore((s) => s.endEditing);
  const beginEditing = useDocumentStore((s) => s.beginEditing);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  return (
    <div
      className={clsx(
        'group relative flex items-stretch rounded-lg bg-white shadow-sm',
        'border border-neutral-200',
        'dark:border-neutral-800 dark:bg-neutral-900',
        selected && 'ring-2 ring-indigo-500/60 ring-offset-1'
      )}
      style={{ width: NODE_WIDTH, minHeight: NODE_MIN_HEIGHT }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (!isEditing) beginEditing(entity.id);
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !border-neutral-300 !bg-white dark:!border-neutral-700 dark:!bg-neutral-900"
      />
      <div
        className="w-1.5 shrink-0 rounded-l-lg"
        style={{ backgroundColor: meta.stripeColor }}
        aria-hidden
      />
      <div className="flex flex-1 flex-col gap-1 px-3 py-2.5">
        <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          {meta.label}
        </span>
        {isEditing ? (
          <textarea
            ref={inputRef}
            className="resize-none border-none bg-transparent p-0 text-node leading-snug text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-neutral-100"
            rows={2}
            defaultValue={entity.title}
            placeholder="State the effect…"
            onBlur={(e) => {
              const next = e.currentTarget.value.trim();
              if (next !== entity.title) updateEntity(entity.id, { title: next });
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
          <span className="text-node leading-snug text-neutral-900 dark:text-neutral-100">
            {entity.title || (
              <span className="italic text-neutral-400">Untitled — double-click to edit</span>
            )}
          </span>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !border-neutral-300 !bg-white dark:!border-neutral-700 dark:!bg-neutral-900"
      />
    </div>
  );
}
