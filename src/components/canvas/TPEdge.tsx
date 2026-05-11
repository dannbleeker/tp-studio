import { BaseEdge, type EdgeProps, getBezierPath } from '@xyflow/react';

export function TPEdge(props: EdgeProps) {
  const [path] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
    sourcePosition: props.sourcePosition,
    targetPosition: props.targetPosition,
  });

  const stroke = props.selected ? '#6366f1' : '#a3a3a3';

  return (
    <BaseEdge
      id={props.id}
      path={path}
      markerEnd={props.markerEnd}
      style={{
        stroke,
        strokeWidth: props.selected ? 2 : 1.5,
        ...props.style,
      }}
    />
  );
}
