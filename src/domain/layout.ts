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

/**
 * Run dagre on a single (assumed-connected or trivially-disconnected)
 * graph. Internal helper for the per-component path below; the exported
 * `computeLayout` splits first and routes each component through here.
 *
 * Returns positions in the component's own local coordinate space —
 * caller is responsible for translating components apart when packing
 * several side-by-side.
 */
const layoutOneComponent = (
  nodes: NodeBox[],
  edges: EdgeRef[],
  opts: Required<Omit<LayoutOptions, 'align'>> & Pick<LayoutOptions, 'align'>
): {
  positions: Record<string, Position>;
  width: number;
  height: number;
} => {
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

  const positions: Record<string, Position> = {};
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const id of g.nodes()) {
    const n = g.node(id);
    const x = n.x - n.width / 2;
    const y = n.y - n.height / 2;
    positions[id] = { x, y };
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x + n.width > maxX) maxX = x + n.width;
    if (y + n.height > maxY) maxY = y + n.height;
  }
  const width = Number.isFinite(maxX - minX) ? maxX - minX : 0;
  const height = Number.isFinite(maxY - minY) ? maxY - minY : 0;
  return { positions, width, height };
};

/**
 * Split a node/edge set into weakly-connected components. Uses
 * union-find over the edge list, then groups nodes by root. Isolated
 * nodes (no edges) end up as 1-node components, which dagre handles
 * fine and which `packComponents` lays out as singletons.
 *
 * Exported for direct test coverage of the partitioning logic — every
 * input node must appear in exactly one output component, and every
 * input edge in exactly the component its endpoints both belong to.
 */
export const splitIntoComponents = (
  nodes: NodeBox[],
  edges: EdgeRef[]
): { nodes: NodeBox[]; edges: EdgeRef[] }[] => {
  const parent: Record<string, string> = {};
  const find = (id: string): string => {
    let cur = id;
    while (parent[cur] !== undefined && parent[cur] !== cur) cur = parent[cur]!;
    parent[id] = cur;
    return cur;
  };
  const unify = (a: string, b: string): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };
  for (const n of nodes) parent[n.id] = n.id;
  for (const e of edges) {
    if (parent[e.sourceId] !== undefined && parent[e.targetId] !== undefined) {
      unify(e.sourceId, e.targetId);
    }
  }
  const byRoot = new Map<string, { nodes: NodeBox[]; edges: EdgeRef[] }>();
  for (const n of nodes) {
    const r = find(n.id);
    if (!byRoot.has(r)) byRoot.set(r, { nodes: [], edges: [] });
    byRoot.get(r)!.nodes.push(n);
  }
  for (const e of edges) {
    if (parent[e.sourceId] === undefined || parent[e.targetId] === undefined) continue;
    const r = find(e.sourceId);
    byRoot.get(r)?.edges.push(e);
  }
  return [...byRoot.values()];
};

/**
 * Stable hash for one (nodes, edges, options) tuple. Used as a cache
 * key — collisions waste a cache miss but never produce wrong output,
 * so the hash doesn't need to be cryptographically robust.
 */
const componentCacheKey = (
  nodes: NodeBox[],
  edges: EdgeRef[],
  opts: Required<Omit<LayoutOptions, 'align'>> & Pick<LayoutOptions, 'align'>
): string => {
  const ns = [...nodes]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((n) => `${n.id}|${n.width}|${n.height}`)
    .join(',');
  const es = [...edges]
    .sort((a, b) =>
      a.sourceId < b.sourceId
        ? -1
        : a.sourceId > b.sourceId
          ? 1
          : a.targetId < b.targetId
            ? -1
            : a.targetId > b.targetId
              ? 1
              : 0
    )
    .map((e) => `${e.sourceId}>${e.targetId}`)
    .join(',');
  return `${opts.direction}|${opts.rankSep}|${opts.nodeSep}|${opts.align ?? ''}|${ns}|${es}`;
};

/**
 * Module-level LRU cache for per-component layout output. Survives
 * across `computeLayout` calls until the page reloads. Capped to keep
 * memory bounded; the eviction policy is "drop oldest" which is fine
 * for the workload (the user generally has at most a few dozen unique
 * subgraphs across their session).
 */
const COMPONENT_CACHE_CAP = 64;
const componentCache = new Map<
  string,
  { positions: Record<string, Position>; width: number; height: number }
>();

/**
 * Test seam — clear the LRU cache so tests don't leak layout state
 * between runs. Production callers should not invoke this.
 */
export const clearLayoutCacheForTests = (): void => {
  componentCache.clear();
};

const COMPONENT_GAP = 80; // mm-ish spacing between separately-laid-out subgraphs

export const computeLayout = (
  nodes: NodeBox[],
  edges: EdgeRef[],
  options: LayoutOptions = {}
): Record<string, Position> => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const components = splitIntoComponents(nodes, edges);
  // Sort components by node count desc so the largest subgraph anchors
  // the top — matches the user's mental model of "main tree first,
  // archived bits below."
  components.sort((a, b) => b.nodes.length - a.nodes.length);
  const laid: Array<{
    positions: Record<string, Position>;
    width: number;
    height: number;
  }> = [];
  for (const c of components) {
    const key = componentCacheKey(c.nodes, c.edges, opts);
    const cached = componentCache.get(key);
    if (cached) {
      // LRU touch — re-insert so it's "freshest" for eviction order.
      componentCache.delete(key);
      componentCache.set(key, cached);
      laid.push(cached);
      continue;
    }
    const fresh = layoutOneComponent(c.nodes, c.edges, opts);
    if (componentCache.size >= COMPONENT_CACHE_CAP) {
      const oldest = componentCache.keys().next().value;
      if (oldest !== undefined) componentCache.delete(oldest);
    }
    componentCache.set(key, fresh);
    laid.push(fresh);
  }
  // Pack components: stack each below the previous with COMPONENT_GAP
  // breathing room. The single-component case (the common one) gets a
  // (0, 0)-anchored layout identical to the pre-split behaviour.
  const result: Record<string, Position> = {};
  let cursorY = 0;
  for (const slab of laid) {
    for (const [id, pos] of Object.entries(slab.positions)) {
      result[id] = { x: pos.x, y: pos.y + cursorY };
    }
    cursorY += slab.height + COMPONENT_GAP;
  }
  return result;
};
