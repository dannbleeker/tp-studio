import { BaseEdge, EdgeLabelRenderer, type EdgeProps, getBezierPath } from '@xyflow/react';
import { EDGE_STROKE_AND, EDGE_STROKE_DEFAULT, EDGE_STROKE_SELECTED } from '../../domain/tokens';
import type { TPEdge as TPEdgeType } from './flow-types';

export function TPEdge(props: EdgeProps<TPEdgeType>) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
    sourcePosition: props.sourcePosition,
    targetPosition: props.targetPosition,
  });

  const isAnd = Boolean(props.data?.andGroupId);

  const stroke = props.selected
    ? EDGE_STROKE_SELECTED
    : isAnd
      ? EDGE_STROKE_AND
      : EDGE_STROKE_DEFAULT;

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
      {/*
        AND junction marker. Every AND-grouped edge renders a small dot just
        before its target endpoint. Because all siblings in the group share the
        same target handle position, their dots stack and read as one visual
        junction where the causes converge.
      */}
      {isAnd && (
        <circle
          cx={props.targetX}
          cy={props.targetY + 10}
          r={3.5}
          fill={EDGE_STROKE_AND}
          stroke="white"
          strokeWidth={1}
        />
      )}
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
