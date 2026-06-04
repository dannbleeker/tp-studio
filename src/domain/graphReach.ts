import { edgeIndex, incomingEdges, outgoingEdges } from './graphCore';
import type { EntityId, TPDocument } from './types';

/**
 * Reachability + path + cycle queries over a TPDocument's edge graph — the
 * BFS / DFS traversals built on the cached edge index in `graphCore.ts`.
 *
 * Split out of `graph.ts` (Session 165). Pure — no store, no React.
 */

/**
 * Forward reachability: every entity reachable by following outgoing edges
 * from any id in `from`. The seed entities themselves are NOT included unless
 * the graph cycles back to one. Pure BFS; safe with cycles (visited set).
 *
 * Returns `Set<EntityId>` — the values are entity ids in practice (BFS
 * walks `Edge.targetId`/`Edge.sourceId`, both already `EntityId`), so
 * callers that compare against an `EntityId`-keyed set (like a
 * `Set<EntityId>` of UDE ids) don't need a cast at the use site.
 */
export const reachableForward = (doc: TPDocument, from: EntityId[]): Set<EntityId> => {
  const out = new Set<EntityId>();
  const queue: EntityId[] = [];
  for (const id of from) {
    for (const e of outgoingEdges(doc, id)) queue.push(e.targetId);
  }
  // Head-index dequeue: O(1) per step vs `queue.shift()`'s O(N) array slide.
  let head = 0;
  while (head < queue.length) {
    const id = queue[head++]!;
    if (out.has(id)) continue;
    out.add(id);
    for (const e of outgoingEdges(doc, id)) queue.push(e.targetId);
  }
  return out;
};

/** Backward counterpart of `reachableForward` — follows incoming edges. */
export const reachableBackward = (doc: TPDocument, from: EntityId[]): Set<EntityId> => {
  const out = new Set<EntityId>();
  const queue: EntityId[] = [];
  for (const id of from) {
    for (const e of incomingEdges(doc, id)) queue.push(e.sourceId);
  }
  // Head-index dequeue: O(1) per step vs `queue.shift()`'s O(N) array slide.
  let head = 0;
  while (head < queue.length) {
    const id = queue[head++]!;
    if (out.has(id)) continue;
    out.add(id);
    for (const e of incomingEdges(doc, id)) queue.push(e.sourceId);
  }
  return out;
};

/**
 * Shortest (by edge count) path from `fromId` to `toId`. Tries the directed
 * path first; if none exists, falls back to undirected so users can ask
 * "is anything between these?" regardless of orientation. Returns the
 * ordered entity ids and the edge ids connecting them, or null when no
 * connection exists in either orientation.
 */
export const findPath = (
  doc: TPDocument,
  fromId: string,
  toId: string
): { entityIds: string[]; edgeIds: string[] } | null => {
  if (fromId === toId) return { entityIds: [fromId], edgeIds: [] };
  if (!doc.entities[fromId] || !doc.entities[toId]) return null;

  const bfs = (directed: boolean): { entityIds: string[]; edgeIds: string[] } | null => {
    const cameFrom = new Map<string, { prev: string; edgeId: string }>();
    const visited = new Set<string>([fromId]);
    const queue: string[] = [fromId];
    let head = 0;
    while (head < queue.length) {
      const cur = queue[head++]!;
      const outs = outgoingEdges(doc, cur).map((e) => ({ next: e.targetId, edge: e }));
      const ins = directed
        ? []
        : incomingEdges(doc, cur).map((e) => ({ next: e.sourceId, edge: e }));
      for (const step of [...outs, ...ins]) {
        if (visited.has(step.next)) continue;
        visited.add(step.next);
        cameFrom.set(step.next, { prev: cur, edgeId: step.edge.id });
        if (step.next === toId) {
          const entityIds: string[] = [toId];
          const edgeIds: string[] = [];
          let walker = toId;
          while (walker !== fromId) {
            const link = cameFrom.get(walker);
            if (!link) return null;
            edgeIds.unshift(link.edgeId);
            walker = link.prev;
            entityIds.unshift(walker);
          }
          return { entityIds, edgeIds };
        }
        queue.push(step.next);
      }
    }
    return null;
  };

  return bfs(true) ?? bfs(false);
};

/**
 * Find every simple directed cycle in the doc's edge graph. Each cycle is
 * returned as an ordered list of entity ids `[a, b, c]` representing the
 * directed walk `a → b → c → a` (the closing edge back to the first entry
 * is implicit). Returns an empty array on an acyclic graph.
 *
 * Implementation is a DFS-with-stack approach: walk forward from each
 * starting node, push entities onto the recursion stack, and when a child
 * is already on the stack a cycle has been found — extract the suffix of
 * the stack starting at that child. After every starting node is fully
 * explored, the cycles set is deduplicated by canonical rotation (the
 * smallest entity id as the starting point) so `[a, b, c]` and `[b, c, a]`
 * count as one cycle.
 *
 * Used by `effectiveBackEdgeIds` (`backEdges.ts`) to auto-detect each cycle's
 * loop-closer (the edge from the last entity in the cycle back to the first).
 */
// Session 135 / Perf #9 — WeakMap-cached on `doc.edges`. Cycle
// membership is a pure function of the edge topology, so it's stable
// until the edge map gets a new reference (any add / remove / re-point).
// Callers (e.g. `effectiveBackEdgeIds`) run this on each cache miss; the
// cache turns the DFS into a one-time cost per edge-set.
const findCyclesCache = new WeakMap<TPDocument['edges'], string[][]>();

export const findCycles = (doc: TPDocument): string[][] => {
  const memo = findCyclesCache.get(doc.edges);
  if (memo) return memo;

  const adj = new Map<string, string[]>();
  for (const id of Object.keys(doc.entities)) adj.set(id, []);
  // Build adjacency from the cached `bySource` index rather than a
  // fresh edge-array scan.
  for (const [sourceId, outs] of edgeIndex(doc).bySource) {
    const list = adj.get(sourceId);
    if (list) for (const e of outs) list.push(e.targetId);
  }

  // Cycle accumulator, keyed by the canonical-rotation string so duplicates
  // discovered from different DFS roots collapse to one entry.
  const cycles = new Map<string, string[]>();

  /** Rotate a cycle so the lexicographically-smallest entity id is first.
   *  Lets two DFS discoveries of the same cycle (different roots) match. */
  const canonicalize = (cycle: string[]): string[] => {
    let minIdx = 0;
    for (let i = 1; i < cycle.length; i++) {
      if ((cycle[i] ?? '') < (cycle[minIdx] ?? '')) minIdx = i;
    }
    return [...cycle.slice(minIdx), ...cycle.slice(0, minIdx)];
  };

  const visited = new Set<string>();
  // Maps each node currently ON the DFS stack to its stack index. Serves BOTH
  // the on-stack membership test and the back-edge slice lookup in O(1) — the
  // previous version paired a `Set` with `stack.indexOf` (O(depth) per back-edge).
  const stackIdx = new Map<string, number>();
  const stack: string[] = [];

  const dfs = (id: string): void => {
    visited.add(id);
    stackIdx.set(id, stack.length);
    stack.push(id);
    for (const next of adj.get(id) ?? []) {
      if (!visited.has(next)) {
        dfs(next);
      } else {
        // Back-edge: the slice from `next` to the top of the stack is a cycle.
        const startIdx = stackIdx.get(next);
        if (startIdx !== undefined) {
          const cycle = canonicalize(stack.slice(startIdx));
          cycles.set(cycle.join('->'), cycle);
        }
      }
    }
    stack.pop();
    stackIdx.delete(id);
  };

  for (const id of adj.keys()) {
    if (!visited.has(id)) dfs(id);
  }

  const result = [...cycles.values()];
  findCyclesCache.set(doc.edges, result);
  return result;
};
