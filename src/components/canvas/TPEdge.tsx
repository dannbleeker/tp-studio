import { BaseEdge, EdgeLabelRenderer, type EdgeProps, getBezierPath } from '@xyflow/react';

export type TPEdgeData = {
  andGroupId?: string;
};

export function TPEdge(props: EdgeProps) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
    sourcePosition: props.sourcePosition,
    targetPosition: props.targetPosition,
  });

  const data = props.data as TPEdgeData | undefined;
  const isAnd = Boolean(data?.andGroupId);

  const stroke = props.selected ? '#6366f1' : isAnd ? '#8b5cf6' : '#a3a3a3';

  return (
    <>
      <BaseEdge
        id={props.id}
        path={path}
        markerEnd={props.markerEnd}
        style={{
          stroke,
          strokeWidth: props.selected ? 2 : isAnd ? 1.75 : 1.5,
          ...props.style,
        }}
      />
      {isAnd && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none absolute select-none rounded-sm bg-violet-500 px-1 text-[9px] font-semibold uppercase tracking-wider text-white shadow-sm"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            AND
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
