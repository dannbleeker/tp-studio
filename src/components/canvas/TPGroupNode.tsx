import { GROUP_COLOR_CLASSES } from '@/domain/groupColors';
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
  const selectGroup = useDocumentStore((s) => s.selectGroup);

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
          // Session 85 (#1) — `Selection` has a dedicated `groups`
          // variant now. `selectGroup` brands the id correctly; no
          // `as unknown as EntityId` cast needed.
          selectGroup(group.id);
        }}
      >
        {group.title || 'Untitled group'}
      </button>
    </div>
  );
}
