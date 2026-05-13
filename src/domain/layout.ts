import dagre from 'dagre';
import {
  LAYOUT_NODE_SEPARATION,
  LAYOUT_RANK_SEPARATION,
  NODE_MIN_HEIGHT,
  NODE_WIDTH,
} from './constants';
import { structuralEntities } from './graph';
import type { LayoutConfig, TPDocument } from './types';

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

export type LayoutDirection = NonNullable<LayoutConfig['direction']>;
export type LayoutAlign = NonNullable<LayoutConfig['align']>;

/**
 * Runtime options accepted by {@link computeLayout}. Mirrors `LayoutConfig`
 * from `src/domain/types.ts` (the persisted per-doc shape) but with
 * snake-cased property names that match dagre's API directly. The two
 * shapes are convertible 1:1 via {@link layoutConfigToOptions} below.
 */
export type LayoutOptions = {
  rankSep?: number;
  nodeSep?: number;
  direction?: LayoutDirection;
  align?: LayoutAlign;
};

const DEFAULT_OPTIONS: Required<Omit<LayoutOptions, 'align'>> & Pick<LayoutOptions, 'align'> = {
  rankSep: LAYOUT_RANK_SEPARATION,
  nodeSep: LAYOUT_NODE_SEPARATION,
  direction: 'BT',
  align: undefined,
};

/**
 * Build the `{ nodes, edges }` pair `computeLayout` expects from a
 * `TPDocument`, using the canonical card dimensions from `@/domain/constants`.
 *
 * Two callers today: the side-by-side compare dialog (renders the full doc
 * twice for diff) and any future preview/snapshot UI that needs a static
 * layout without going through the React-Flow `useGraphView` pipeline.
 * The main canvas pipeline (`useGraphPositions`) builds its own model
 * because it has to thread visibility/collapsed-group state through the
 * adapter; keep that one separate.
 *
 * Assumptions are excluded — they're metadata on edges, not entities that
 * should occupy graph space.
 */
export const docToLayoutModel = (
  doc: TPDocument,
  size: { width: number; height: number } = { width: NODE_WIDTH, height: NODE_MIN_HEIGHT }
): { nodes: NodeBox[]; edges: EdgeRef[] } => {
  const nodes: NodeBox[] = structuralEntities(doc).map((e) => ({
    id: e.id,
    width: size.width,
    height: size.height,
  }));
  const edges: EdgeRef[] = Object.values(doc.edges).map((e) => ({
    sourceId: e.sourceId,
    targetId: e.targetId,
  }));
  return { nodes, edges };
};

/**
 * Adapt a persisted {@link LayoutConfig} (per-doc, sparse) to the runtime
 * `LayoutOptions` shape dagre expects. Missing fields in the input fall
 * through; the caller still spreads defaults on top.
 */
export const layoutConfigToOptions = (cfg: LayoutConfig | undefined): LayoutOptions => {
  if (!cfg) return {};
  return {
    ...(cfg.direction ? { direction: cfg.direction } : {}),
    ...(cfg.align ? { align: cfg.align } : {}),
    ...(typeof cfg.nodesep === 'number' ? { nodeSep: cfg.nodesep } : {}),
    ...(typeof cfg.ranksep === 'number' ? { rankSep: cfg.ranksep } : {}),
  };
};

export const computeLayout = (
  nodes: NodeBox[],
  edges: EdgeRef[],
  options: LayoutOptions = {}
): Record<string, Position> => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const g = new dagre.graphlib.Graph();
  // `align` is left off the graph config when undefined — dagre uses its
  // own default placement strategy then. Passing `undefined` explicitly
  // would override that with a no-op string and surprise the layout.
  g.setGraph({
    rankdir: opts.direction,
    ranksep: opts.rankSep,
    nodesep: opts.nodeSep,
    ...(opts.align ? { align: opts.align } : {}),
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
