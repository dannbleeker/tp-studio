import { GROUP_COLOR_CLASSES } from '@/domain/groupColors';
import { HANDLE_ORIENTATION } from '@/domain/layoutStrategy';
import { useDocumentStore } from '@/store';
import { Handle, type NodeProps, Position } from '@xyflow/react';
import clsx from 'clsx';
import { ChevronRight } from 'lucide-react';
import type { TPCollapsedGroupNode as TPCollapsedGroupNodeType } from './flow-types';

/**
 * Collapsed group renderer. Visually a single big node that stands in for
 * the entire group; double-click to expand. Has source + target handles so
 * aggregated edges can connect to it. The internal-edge / external-edge
 * routing is done in useGraphView; this component is purely presentational.
 */
export function TPCollapsedGroupNode({ data, selected }: NodeProps<TPCollapsedGroupNodeType>) {
  const { group, memberCount, width, height } = data;
  const colors = GROUP_COLOR_CLASSES[group.color];
  const toggle = useDocumentStore((s) => s.toggleGroupCollapsed);
  // Handle orientation tracks the current diagram type (vertical for the
  // auto-layout trees; horizontal for Evaporating Cloud's L→R flow).
  const diagramType = useDocumentStore((s) => s.doc.diagramType);
  const isHorizontal = HANDLE_ORIENTATION[diagramType] === 'horizontal';
  const targetPosition = isHorizontal ? Position.Right : Position.Bottom;
  const sourcePosition = isHorizontal ? Position.Left : Position.Top;

  return (
    <div
      className={clsx(
        'relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 px-3 py-2 text-center shadow-sm transition',
        colors.bgStrong,
        colors.border,
        selected && 'ring-2 ring-indigo-500/60 ring-offset-1'
      )}
      style={{ width, height }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        toggle(group.id);
      }}
      title="Double-click to expand"
    >
      <Handle
        type="target"
        position={targetPosition}
        className="!h-2 !w-2 !border-neutral-300 !bg-white dark:!border-neutral-700 dark:!bg-neutral-900"
      />
      <ChevronRight className={clsx('mb-1 h-3.5 w-3.5', colors.text)} />
      <span
        className={clsx('line-clamp-2 text-sm font-semibold uppercase tracking-wide', colors.text)}
      >
        {group.title || 'Untitled group'}
      </span>
      <span className="mt-1 text-[10px] text-neutral-500 dark:text-neutral-400">
        {memberCount} {memberCount === 1 ? 'member' : 'members'}
      </span>
      <Handle
        type="source"
        position={sourcePosition}
        className="!h-2 !w-2 !border-neutral-300 !bg-white dark:!border-neutral-700 dark:!bg-neutral-900"
      />
    </div>
  );
}
