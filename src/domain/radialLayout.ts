import type { EdgeRef, NodeBox, Position } from './layout';

/**
 * Radial / sunburst layout for tree-shaped or DAG-shaped diagrams. Used by
 * F5 as an alternate to dagre. The apex of the dependency graph — entities
 * with no outgoing edges (CRT UDEs, FRT desired effects, PRT goals, TT
 * desired effects) — sits at the center; everything that contributes to
 * them radiates outward on concentric rings.
 *
 * Algorithm:
 *   1. Pick "centers": nodes with no outgoing edges within the visible
 *      set. (For our trees this is always the apex; for an isolated graph
 *      we fall back to the first node so something renders.)
 *   2. BFS via incoming edges, assigning each reached node a `level` equal
 *      to its minimum directed distance from any center.
 *   3. Nodes unreached from any center (cycles, disconnected islands) land
 *      at level 0 alongside the centers.
 *   4. **Subtree-weighted angular allocation** (Session 76 polish — the
 *      pre-polish version distributed each level uniformly around its ring,
 *      which made skewed trees scatter children far from their parents).
 *      Per node, compute the size of the subtree it heads (= 1 + sum of
 *      child subtree sizes). Each center claims an angular slice of 2π
 *      proportional to its subtree size; each child claims a sub-slice of
 *      its parent's range proportional to its own subtree size; nodes sit
 *      at the centroid of their slice. The result: children stay angularly
 *      close to their parent, and sibling branches don't fight for the
 *      same arc.
 *   5. Normalize so the layout's bounding box top-left sits at (0, 0) —
 *      matches dagre's convention so downstream code (group rectangles,
 *      collapsed-root cards, etc.) doesn't care which layout produced
 *      the positions.
 *
 * DAG handling: when a node has multiple parents (incoming edges from
 * different lower-level nodes), it's assigned to the parent encountered
 * first during the top-down BFS so its angular position is deterministic.
 * Cross-parent edges still render as straight lines through the angular
 * space, which is the right read for "this child also contributes to that
 * other branch."
 *
 * Positions are top-left (matching dagre and the rest of the canvas);
 * callers can offset by half the node size if they want centers.
 */

const RING_STEP = 280;
const INNER_RING_RATIO = 0.5;

export const radialLayout = (nodes: NodeBox[], edges: EdgeRef[]): Record<string, Position> => {
  if (nodes.length === 0) return {};
  if (nodes.length === 1) {
    const only = nodes[0];
    if (!only) return {};
    return { [only.id]: { x: 0, y: 0 } };
  }

  const ids = new Set(nodes.map((n) => n.id));
  const widthBy = new Map<string, number>();
  const heightBy = new Map<string, number>();
  for (const n of nodes) {
    widthBy.set(n.id, n.width);
    heightBy.set(n.id, n.height);
  }

  // Build adjacency restricted to visible nodes only — an edge pointing at
  // an entity that's been hidden by a collapsed group shouldn't affect
  // levels in the visible view.
  const outDeg = new Map<string, number>();
  const inFrom = new Map<string, string[]>();
  for (const id of ids) {
    outDeg.set(id, 0);
    inFrom.set(id, []);
  }
  for (const e of edges) {
    if (!ids.has(e.sourceId) || !ids.has(e.targetId)) continue;
    outDeg.set(e.sourceId, (outDeg.get(e.sourceId) ?? 0) + 1);
    inFrom.get(e.targetId)?.push(e.sourceId);
  }

  // Centers: nodes with no outgoing edges within the visible set.
  const centers: string[] = [];
  for (const id of ids) if ((outDeg.get(id) ?? 0) === 0) centers.push(id);
  // Preserve input order for stability across renames.
  centers.sort((a, b) => nodes.findIndex((n) => n.id === a) - nodes.findIndex((n) => n.id === b));
  // Fallback: a fully-cyclic visible graph has no center; pick the first
  // node so we render something rather than nothing.
  if (centers.length === 0) {
    const first = nodes[0];
    if (first) centers.push(first.id);
  }

  const level = new Map<string, number>();
  // Each child is assigned to ONE parent for angular allocation — the
  // first parent encountered during top-down BFS. Stored as childId → parentId.
  // Multi-parent DAG nodes still have their other inbound edges drawn,
  // they just inherit angular range from a single parent.
  const angularParent = new Map<string, string>();
  // For each parent, the ordered list of children we'll lay out beneath it.
  const childrenOf = new Map<string, string[]>();
  for (const id of ids) childrenOf.set(id, []);

  for (const c of centers) level.set(c, 0);
  const queue: string[] = [...centers];
  while (queue.length > 0) {
    const cur = queue.shift();
    if (cur === undefined) break;
    const curLevel = level.get(cur) ?? 0;
    for (const prev of inFrom.get(cur) ?? []) {
      if (!level.has(prev)) {
        level.set(prev, curLevel + 1);
        angularParent.set(prev, cur);
        childrenOf.get(cur)?.push(prev);
        queue.push(prev);
      }
    }
  }
  // Unreached (cyclic islands, disconnected nodes) land alongside the
  // centers. They're cosmetically less ideal but don't disappear.
  for (const id of ids) {
    if (!level.has(id)) level.set(id, 0);
  }
  // Anything that hit level 0 via the unreached path needs to appear in
  // the center list so the angular allocator sees it; same for orphans.
  for (const id of ids) {
    if (level.get(id) === 0 && !centers.includes(id)) centers.push(id);
  }

  // Pass 1: compute subtree size per node, bottom-up. Subtree size of a
  // leaf is 1; subtree size of an internal node is 1 + sum of its
  // children's subtree sizes. Use DFS over the angularParent tree
  // (which is guaranteed acyclic — it's a tree built top-down).
  const subtreeSize = new Map<string, number>();
  const sizeFor = (id: string): number => {
    const memo = subtreeSize.get(id);
    if (memo !== undefined) return memo;
    let size = 1;
    for (const child of childrenOf.get(id) ?? []) size += sizeFor(child);
    subtreeSize.set(id, size);
    return size;
  };
  for (const id of ids) sizeFor(id);

  // Pass 2: allocate angular ranges top-down. Each center gets a slice
  // of [0, 2π) proportional to its subtree size; recursively each child
  // gets a sub-slice of its parent's range proportional to its own
  // subtree size. The node sits at the centroid of its slice.
  type Slice = { start: number; end: number };
  const slice = new Map<string, Slice>();

  // Centers share the full ring. Pure single-center diagrams collapse to
  // a degenerate "the only center has the full ring" — fine, but we'll
  // still place the lone center at the exact origin (special-cased below).
  const totalCenterSize = centers.reduce((acc, c) => acc + (subtreeSize.get(c) ?? 1), 0);
  {
    let cursor = -Math.PI / 2; // start at "12 o'clock"
    for (const c of centers) {
      const share = (subtreeSize.get(c) ?? 1) / totalCenterSize;
      const arc = share * 2 * Math.PI;
      slice.set(c, { start: cursor, end: cursor + arc });
      cursor += arc;
    }
  }

  const assignChildren = (parent: string): void => {
    const kids = childrenOf.get(parent);
    if (!kids || kids.length === 0) return;
    const parentSlice = slice.get(parent);
    if (!parentSlice) return;
    const kidsTotal = kids.reduce((acc, k) => acc + (subtreeSize.get(k) ?? 1), 0);
    let cursor = parentSlice.start;
    for (const k of kids) {
      const share = (subtreeSize.get(k) ?? 1) / kidsTotal;
      const arc = share * (parentSlice.end - parentSlice.start);
      slice.set(k, { start: cursor, end: cursor + arc });
      cursor += arc;
      assignChildren(k);
    }
  };
  for (const c of centers) assignChildren(c);

  const positions: Record<string, Position> = {};

  // Single-center special case: place the lone center at the origin
  // rather than on a ring. Matches the pre-polish behavior so existing
  // tests / examples don't shuffle.
  if (centers.length === 1) {
    const c = centers[0];
    if (c) positions[c] = { x: 0, y: 0 };
  }

  for (const id of ids) {
    if (positions[id]) continue; // already placed (lone center)
    const lv = level.get(id) ?? 0;
    const s = slice.get(id);
    // Angle = centroid of the allocated slice. Fallback to 0 for
    // degenerate cases (unreached island with no slice assigned).
    const angle = s ? (s.start + s.end) / 2 : 0;
    const radius = lv === 0 ? RING_STEP * INNER_RING_RATIO : RING_STEP * lv;
    const cx = radius * Math.cos(angle);
    const cy = radius * Math.sin(angle);
    positions[id] = {
      x: cx - (widthBy.get(id) ?? 0) / 2,
      y: cy - (heightBy.get(id) ?? 0) / 2,
    };
  }

  // Normalize so the bounding-box top-left is at (0, 0) — matches dagre's
  // convention. Without this, downstream group-rectangle math has to deal
  // with negative coordinates that nothing else produces.
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  for (const p of Object.values(positions)) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
  }
  if (Number.isFinite(minX) && Number.isFinite(minY)) {
    for (const id of Object.keys(positions)) {
      const p = positions[id];
      if (p) positions[id] = { x: p.x - minX, y: p.y - minY };
    }
  }

  return positions;
};
