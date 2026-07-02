import dagre from 'dagre';
import {
  LAYOUT_FANOUT_BONUS_THRESHOLD,
  LAYOUT_NODE_SEPARATION,
  LAYOUT_RANK_SEPARATION,
  LAYOUT_RANK_SEPARATION_FAN_STEP,
  LAYOUT_RANK_SEPARATION_JUNCTOR_MIN,
  LAYOUT_RANK_SEPARATION_MAX_BONUS,
  NODE_MIN_HEIGHT,
  NODE_WIDTH,
} from './constants';
import { structuralEntities } from './graph';
import type { LayoutConfig, TPDocument } from './types';

export type NodeBox = {
  id: string;
  width: number;
  height: number;
  /** Session 193 — optional manual sibling order. When EVERY node in a layout
   *  rank carries an `ordering`, the post-dagre pass permutes them into that
   *  order along the free axis (reusing their existing slots, so spacing +
   *  rank are preserved). Absent everywhere → the pass is a strict no-op, so
   *  nothing shifts until a user sets it. */
  ordering?: number;
};

export type EdgeRef = {
  sourceId: string;
  targetId: string;
  /** True when this edge feeds an AND/OR/XOR junctor. Drives the junctor rank
   *  floor in `computeLayout` so the circle (which sits below the target) has
   *  room and doesn't render behind the cause cards. */
  isJunctor?: boolean;
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

// `align` deliberately omitted: dagre treats "no align" specially
// (it's not the same as align=UL/UR/etc.) and exactOptionalPropertyTypes
// rejects the explicit `align: undefined` we used to write.
const DEFAULT_OPTIONS: Required<Omit<LayoutOptions, 'align'>> = {
  rankSep: LAYOUT_RANK_SEPARATION,
  nodeSep: LAYOUT_NODE_SEPARATION,
  direction: 'BT',
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
    ...(typeof e.ordering === 'number' ? { ordering: e.ordering } : {}),
  }));
  const edges: EdgeRef[] = Object.values(doc.edges).map((e) => ({
    sourceId: e.sourceId,
    targetId: e.targetId,
    isJunctor: Boolean(e.andGroupId || e.orGroupId || e.xorGroupId),
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

// -- Goal #4 — post-dagre centering pass ----------------------------------
//
// dagre's Brandes-Köpf x-assignment balances a mid-tree node between its
// parent (sink side) and its children (source side). When an effect has a
// parent above AND causes below, the parent tugs the effect sideways off
// its causes — so the locked shortest-side edge anchoring (#5) then enters
// the effect on its *side*, drawing a long diagonal. This pass re-centers
// each node over the mean position of its causes (flow-source neighbours),
// turning that diagonal into a short bottom→top connector.
//
// It runs AFTER `dagre.layout` on dagre's centre coords, mutating them in
// place. It is a pure function of the same (nodes, edges, opts) tuple dagre
// already saw — so the per-component layout cache stays valid — and it
// never reorders nodes within a rank or shrinks the `nodeSep` gap, so it
// can't introduce crossings or overlaps.

const CENTERING_ITERATIONS = 2;
const CENTERING_EPS = 0.5;

const balanceFreeAxis = (
  g: dagre.graphlib.Graph,
  opts: { direction: LayoutDirection; nodeSep: number },
  nodes: NodeBox[],
  edges: EdgeRef[]
): void => {
  // Nothing to balance with 0–2 nodes (a single chain is already aligned).
  if (nodes.length <= 2) return;
  // BT/TB flow vertically → re-centre on X; LR/RL → re-centre on Y. The
  // "source side" (where causes sit along the rank axis) flips per dir.
  const vertical = opts.direction === 'BT' || opts.direction === 'TB';
  const sourceAtLargerRank = opts.direction === 'BT' || opts.direction === 'RL';

  const freeOf = (id: string): number => {
    const n = g.node(id);
    return vertical ? n.x : n.y;
  };
  const setFree = (id: string, v: number): void => {
    const n = g.node(id);
    // Write through `setNode` with a copied label rather than mutating the
    // dagre node object in place, so this doesn't rely on graphlib handing
    // back a per-node label reference that's safe to mutate. (`g` is local to
    // the component layout and discarded afterward; the copy keeps that
    // invariant explicit.)
    g.setNode(id, vertical ? { ...n, x: v } : { ...n, y: v });
  };
  const rankOf = (id: string): number => {
    const n = g.node(id);
    return vertical ? n.y : n.x;
  };
  const freeExtentOf = (id: string): number => {
    const n = g.node(id);
    return vertical ? n.width : n.height;
  };

  const realIds = new Set(nodes.map((n) => n.id));
  // causes[effect] = its source-side neighbours (real edges only).
  const causes = new Map<string, string[]>();
  for (const e of edges) {
    if (!realIds.has(e.sourceId) || !realIds.has(e.targetId)) continue;
    const arr = causes.get(e.targetId);
    if (arr) arr.push(e.sourceId);
    else causes.set(e.targetId, [e.sourceId]);
  }

  // Bucket real nodes by rank-axis coord (dagre assigns one value per rank).
  const ranks = new Map<number, string[]>();
  for (const n of nodes) {
    const r = rankOf(n.id);
    const row = ranks.get(r);
    if (row) row.push(n.id);
    else ranks.set(r, [n.id]);
  }
  // Process source → sink so a node's causes are finalized before it.
  const rankCoords = [...ranks.keys()].sort((a, b) => (sourceAtLargerRank ? b - a : a - b));

  for (let iter = 0; iter < CENTERING_ITERATIONS; iter++) {
    let moved = false;
    for (const rc of rankCoords) {
      const row = ranks.get(rc);
      if (!row || row.length === 0) continue;
      // Stable left→right order by current free coord (id tie-break).
      row.sort((a, b) => {
        const fa = freeOf(a);
        const fb = freeOf(b);
        return fa !== fb ? fa - fb : a < b ? -1 : a > b ? 1 : 0;
      });
      const desired = row.map((id) => {
        const cs = causes.get(id);
        if (!cs || cs.length === 0) return freeOf(id);
        let sum = 0;
        for (const c of cs) sum += freeOf(c);
        return sum / cs.length;
      });
      // Forward min-gap clamp — order-preserving, guarantees no overlap.
      const pos = desired.slice();
      for (let i = 1; i < row.length; i++) {
        const gap = nodeSepBetween(freeExtentOf(row[i - 1]!), freeExtentOf(row[i]!), opts.nodeSep);
        const lo = pos[i - 1]! + gap;
        if (pos[i]! < lo) pos[i] = lo;
      }
      // Re-centre the row's centroid onto the desired centroid so the
      // forward clamp's right-bias doesn't skew the rank off its causes.
      // A uniform shift preserves every gap, so no overlap is introduced.
      let shift = 0;
      for (let i = 0; i < row.length; i++) shift += pos[i]! - desired[i]!;
      shift /= row.length;
      for (let i = 0; i < row.length; i++) {
        const target = pos[i]! - shift;
        if (Math.abs(target - freeOf(row[i]!)) > CENTERING_EPS) {
          setFree(row[i]!, target);
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
};

// -- Session 193 — manual sibling ordering ---------------------------------
//
// dagre has no per-node sibling-order input, so we honour `NodeBox.ordering`
// as a post-dagre pass: for each rank whose nodes ALL carry an `ordering`,
// permute them into ascending order using their own already-assigned free-axis
// slots. This preserves rank (never touched) and spacing (the slot set is
// reused verbatim), so it can't overlap or shift a rank as a whole — it only
// swaps which node sits in which slot. Runs on dagre's centre coords in place,
// after `balanceFreeAxis`; it's a pure function of the same (nodes, edges,
// opts) tuple, so the per-component cache stays valid.
//
// Guarded two ways so it's a strict no-op for every diagram that doesn't use
// the feature: it returns immediately when no node has an `ordering`, and it
// skips any rank that isn't FULLY ordered (a mixed rank stays exactly as dagre
// placed it). The manual-order setter always stamps ordering on the whole rank
// at once, so a user-reordered rank is always fully ordered.
const REORDER_RANK_EPS = 1;

const reorderManualSiblings = (
  g: dagre.graphlib.Graph,
  opts: { direction: LayoutDirection },
  nodes: NodeBox[]
): void => {
  const orderOf = new Map<string, number>();
  for (const n of nodes) {
    if (typeof n.ordering === 'number') orderOf.set(n.id, n.ordering);
  }
  if (orderOf.size === 0) return; // no manual order anywhere → nothing to do

  const vertical = opts.direction === 'BT' || opts.direction === 'TB';
  const freeOf = (id: string): number => {
    const n = g.node(id);
    return vertical ? n.x : n.y;
  };
  const setFree = (id: string, v: number): void => {
    const n = g.node(id);
    g.setNode(id, vertical ? { ...n, x: v } : { ...n, y: v });
  };
  const rankOf = (id: string): number => {
    const n = g.node(id);
    return vertical ? n.y : n.x;
  };

  // Bucket node ids by their rank-axis coordinate (dagre gives each rank one
  // exact value; round for float safety).
  const byRank = new Map<number, string[]>();
  for (const id of g.nodes()) {
    const key = Math.round(rankOf(id) / REORDER_RANK_EPS) * REORDER_RANK_EPS;
    const arr = byRank.get(key);
    if (arr) arr.push(id);
    else byRank.set(key, [id]);
  }

  for (const ids of byRank.values()) {
    if (ids.length < 2) continue;
    if (!ids.every((id) => orderOf.has(id))) continue; // only fully-ordered ranks
    // The rank's existing free-axis slots, ascending — reused so spacing holds.
    const slots = ids.map(freeOf).sort((a, b) => a - b);
    // Nodes sorted by manual order (id as a stable tie-break).
    const sorted = [...ids].sort(
      (a, b) => orderOf.get(a)! - orderOf.get(b)! || (a < b ? -1 : a > b ? 1 : 0)
    );
    sorted.forEach((id, i) => setFree(id, slots[i]!));
  }
};

/** Centre-to-centre minimum gap reproducing dagre's edge-to-edge `nodesep`. */
const nodeSepBetween = (extentA: number, extentB: number, nodeSep: number): number =>
  nodeSep + (extentA + extentB) / 2;

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
  // Goal #4 — re-centre each node over its causes (see `balanceFreeAxis`).
  balanceFreeAxis(g, opts, nodes, edges);
  // Session 193 — honour manual sibling ordering (no-op unless set).
  reorderManualSiblings(g, opts, nodes);

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
    .map((n) => `${n.id}|${n.width}|${n.height}|${n.ordering ?? ''}`)
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
  componentCacheHits = 0;
  componentCacheMisses = 0;
};

// Session 129 — FL-LA4 follow-up. Per-component cache observability so
// tests can pin the reuse contract (when a component didn't change,
// dagre must not re-run) and so a future perf-trace can measure the
// real hit-rate on a production scenario instead of guessing at it.
// Counters reset alongside the cache via `clearLayoutCacheForTests`.
let componentCacheHits = 0;
let componentCacheMisses = 0;
export const getLayoutCacheStats = (): { hits: number; misses: number; size: number } => ({
  hits: componentCacheHits,
  misses: componentCacheMisses,
  size: componentCache.size,
});

const COMPONENT_GAP = 80; // mm-ish spacing between separately-laid-out subgraphs

/**
 * Adaptive rank-spacing bonus (Session 146). Extra px to add to the base
 * rank separation based on the widest fan in the graph — the largest
 * in-degree (causes converging on one effect) or out-degree (one cause
 * branching to many effects) at any node. Wide fans make vertical-entry
 * connectors steep; more vertical room flattens the angle so the map flows
 * better. Capped at LAYOUT_RANK_SEPARATION_MAX_BONUS so a huge fan can't blow
 * the diagram up; fan ≤ the threshold (binary / linear trees) gets 0 — the
 * common case stays exactly as before.
 *
 * Computed once over the whole edge set and applied to every component, so
 * spacing is consistent across a multi-component diagram. Pure function of
 * (nodes, edges), so it doesn't disturb the per-component layout cache key.
 */
export const fanoutRankBonus = (nodes: NodeBox[], edges: EdgeRef[]): number => {
  const ids = new Set(nodes.map((n) => n.id));
  const inDeg = new Map<string, number>();
  const outDeg = new Map<string, number>();
  for (const e of edges) {
    if (!ids.has(e.sourceId) || !ids.has(e.targetId)) continue;
    outDeg.set(e.sourceId, (outDeg.get(e.sourceId) ?? 0) + 1);
    inDeg.set(e.targetId, (inDeg.get(e.targetId) ?? 0) + 1);
  }
  let maxFan = 0;
  for (const d of inDeg.values()) if (d > maxFan) maxFan = d;
  for (const d of outDeg.values()) if (d > maxFan) maxFan = d;
  const extraBranches = Math.max(0, maxFan - LAYOUT_FANOUT_BONUS_THRESHOLD);
  return Math.min(
    extraBranches * LAYOUT_RANK_SEPARATION_FAN_STEP,
    LAYOUT_RANK_SEPARATION_MAX_BONUS
  );
};

export const computeLayout = (
  nodes: NodeBox[],
  edges: EdgeRef[],
  options: LayoutOptions = {}
): Record<string, Position> => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  // Session 146 — widen rank spacing for wide-fan graphs (capped). Applied to
  // the resolved base (incl. any per-doc rankSep override) so every component
  // shares the same spacing.
  opts.rankSep += fanoutRankBonus(nodes, edges);
  // Junctor circles sit ~69 px below their target node; ensure the rank gap
  // clears the circle so it doesn't render behind the cause cards (the
  // occlusion report). A floor, not an add — fanout-boosted spacing still wins.
  if (edges.some((e) => e.isJunctor)) {
    opts.rankSep = Math.max(opts.rankSep, LAYOUT_RANK_SEPARATION_JUNCTOR_MIN);
  }
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
      componentCacheHits += 1;
      laid.push(cached);
      continue;
    }
    componentCacheMisses += 1;
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
