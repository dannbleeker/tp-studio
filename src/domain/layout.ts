import dagre from 'dagre';
import { LAYOUT_NODE_SEPARATION, LAYOUT_RANK_SEPARATION } from './constants';

export type NodeBox = {
  id: string;
  width: number;
  height: number;
};

export type EdgeRef = {
  sourceId: string;
  targetId: string;
};

export type Position = {
  x: number;
  y: number;
};

export type LayoutDirection = 'TB' | 'BT' | 'LR' | 'RL';

export type LayoutOptions = {
  rankSep?: number;
  nodeSep?: number;
  direction?: LayoutDirection;
};

const DEFAULT_OPTIONS: Required<LayoutOptions> = {
  rankSep: LAYOUT_RANK_SEPARATION,
  nodeSep: LAYOUT_NODE_SEPARATION,
  direction: 'BT',
};

export const computeLayout = (
  nodes: NodeBox[],
  edges: EdgeRef[],
  options: LayoutOptions = {}
): Record<string, Position> => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: opts.direction,
    ranksep: opts.rankSep,
    nodesep: opts.nodeSep,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const n of nodes) {
    g.setNode(n.id, { width: n.width, height: n.height });
  }
  for (const e of edges) {
    if (g.hasNode(e.sourceId) && g.hasNode(e.targetId)) {
      g.setEdge(e.sourceId, e.targetId);
    }
  }

  dagre.layout(g);

  const result: Record<string, Position> = {};
  for (const id of g.nodes()) {
    const n = g.node(id);
    result[id] = { x: n.x - n.width / 2, y: n.y - n.height / 2 };
  }
  return result;
};
