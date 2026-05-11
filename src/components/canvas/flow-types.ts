import type { Entity } from '@/domain/types';
import type { Edge as RFEdge, Node as RFNode } from '@xyflow/react';

export type TPNodeData = {
  entity: Entity;
};

export type TPEdgeData = {
  andGroupId?: string;
};

export type TPNode = RFNode<TPNodeData, 'tp'>;
export type TPEdge = RFEdge<TPEdgeData, 'tp'>;
