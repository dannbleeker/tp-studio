import { GROUP_COLOR_CLASSES } from '@/domain/groupColors';
import type { EntityId } from '@/domain/types';
import { useDocumentStore } from '@/store';
import type { NodeProps } from '@xyflow/react';
import clsx from 'clsx';
import type { TPGroupNode as TPGroupNodeType } from './flow-types';

/**
 * A group is a non-interactive labelled rounded rectangle drawn behind its
 * member entities. Clicks on a group's body select the group; clicks on
 * member entities (rendered above) still register normally because the
 * group node has `pointerEvents: none` on its inner area except the title.
 */
export function TPGroupNode({ data, selected }: NodeProps<TPGroupNodeType>) {
  const { group, width, height } = data;
  const colors = GROUP_COLOR_CLASSES[group.color];
  const select = useDocumentStore((s) => s.select);

  return (
    <div
      className={clsx(
        'pointer-events-none relative rounded-lg border-2 border-dashed',
        colors.bg,
        colors.border,
        selected && 'ring-2 ring-indigo-500/60 ring-offset-1'
      )}
      style={{ width, height }}
    >
      <button
        type="button"
        className={clsx(
          '-top-2.5 pointer-events-auto absolute left-3 cursor-pointer rounded-md bg-white px-2 py-0.5 font-semibold text-[10px] uppercase tracking-wide shadow-sm dark:bg-neutral-950',
          colors.text
        )}
        onClick={(e) => {
          e.stopPropagation();
          // Groups are selected through the `entities` bucket — the
          // Inspector reads `doc.groups[id]` when the id matches a
          // group rather than an entity. The brand cast acknowledges
          // this shared bucket; a future Selection model with a
          // distinct `groups` kind would remove the cast.
          select({ kind: 'entities', ids: [group.id as unknown as EntityId] });
        }}
      >
        {group.title || 'Untitled group'}
      </button>
    </div>
  );
}
