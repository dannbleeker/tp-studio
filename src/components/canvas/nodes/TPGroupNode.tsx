import type { NodeProps } from '@xyflow/react';
import clsx from 'clsx';
import { Archive } from 'lucide-react';
import { memo } from 'react';
import { GROUP_COLOR_CLASSES } from '@/domain/groupColors';
import { useDocumentStore } from '@/store';
import type { TPGroupNode as TPGroupNodeType } from '../edges/flow-types';

/**
 * A group is a non-interactive labelled rounded rectangle drawn behind its
 * member entities. Clicks on a group's body select the group; clicks on
 * member entities (rendered above) still register normally because the
 * group node has `pointerEvents: none` on its inner area except the title.
 *
 * `memo`'d like the other per-node components (TPNode / TPEdge): the emission
 * pass rebuilds the `data` object every run (incl. every drag frame), so the
 * custom comparator below compares its *contents* — the group ref (captures any
 * title/color/archived change) + the bbox dimensions + `selected` — so an
 * unrelated drag or a far-off store change doesn't re-render every group. The
 * `selectGroup` action is read imperatively via `getState()` at click time
 * rather than as a render-time subscription.
 */
function TPGroupNodeImpl({ data, selected }: NodeProps<TPGroupNodeType>) {
  const { group, width, height } = data;
  const colors = GROUP_COLOR_CLASSES[group.color];

  return (
    <div
      className={clsx(
        'pointer-events-none relative rounded-lg border-2 border-dashed',
        colors.bg,
        colors.border,
        // Session 135 medium gap — an archived group only renders at all
        // when "show archived" is on; when it does, dim it so it reads
        // as parked-but-preserved rather than live reasoning.
        group.archived && 'opacity-50 saturate-50',
        selected && 'ring-2 ring-accent-500/60 ring-offset-1'
      )}
      style={{ width, height }}
    >
      <button
        type="button"
        className={clsx(
          'pointer-events-auto absolute -top-2.5 left-3 flex cursor-pointer items-center gap-1 rounded-md bg-white px-2 py-0.5 font-semibold text-[10px] uppercase tracking-wide shadow-xs dark:bg-neutral-950',
          colors.text
        )}
        onClick={(e) => {
          e.stopPropagation();
          // `Selection` has a dedicated `groups` variant; `selectGroup` brands
          // the id correctly. Read imperatively at click time so this component
          // carries no render-time store subscription.
          useDocumentStore.getState().selectGroup(group.id);
        }}
      >
        {group.archived && <Archive className="h-3 w-3" aria-label="Archived" />}
        {group.title || 'Untitled group'}
      </button>
    </div>
  );
}

export const TPGroupNode = memo(
  TPGroupNodeImpl,
  (prev, next) =>
    prev.selected === next.selected &&
    prev.data.group === next.data.group &&
    prev.data.width === next.data.width &&
    prev.data.height === next.data.height
);
