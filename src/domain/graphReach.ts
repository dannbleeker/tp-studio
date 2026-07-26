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
 * Upper bound on enumerated circuits. Johnson's is output-sensitive — its cost
 * scales with the NUMBER of elementary circuits, and that number is exponential
 * in the worst case (a complete digraph on 20 nodes has ~10^17). Real TOC
 * diagrams have a handful of small loops, so this ceiling is unreachable in
 * practice; it exists so a pathological or generated document degrades (some
 * loops don't get a back-edge / an R-B badge) instead of hanging the canvas.
 */
const MAX_CYCLES = 1000;

/**
 * Tarjan's strongly-connected components over the subgraph induced on the nodes
 * `inSub` accepts. Each SCC comes back as a list of ids. A directed graph's
 * elementary circuits live entirely inside one SCC, which is what lets Johnson
 * partition the search below.
 */
const stronglyConnectedComponents = (
  nodes: readonly string[],
  adj: ReadonlyMap<string, string[]>,
  inSub: (id: string) => boolean
): string[][] => {
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const out: string[][] = [];
  let counter = 0;

  // Iterative, not recursive. The recursive form's depth equals the longest
  // simple path, so it threw `RangeError: Maximum call stack size exceeded` on a
  // plain acyclic CHAIN of ~8000+ entities — and `findCycles` sits on the canvas
  // render path via `effectiveBackEdgeIds`, so the throw killed the render
  // rather than degrading. An explicit frame stack has no such ceiling.
  const push = (v: string): void => {
    index.set(v, counter);
    low.set(v, counter);
    counter++;
    stack.push(v);
    onStack.add(v);
  };

  const strongConnect = (start: string): void => {
    push(start);
    // Each frame remembers how far through `v`'s adjacency it got, which is what
    // the call stack was doing implicitly.
    const work: { v: string; next: number }[] = [{ v: start, next: 0 }];
    while (work.length > 0) {
      const frame = work[work.length - 1];
      if (!frame) break;
      const neighbours = adj.get(frame.v) ?? [];
      let descended = false;
      while (frame.next < neighbours.length) {
        const w = neighbours[frame.next];
        frame.next++;
        if (w === undefined || !inSub(w)) continue;
        if (!index.has(w)) {
          push(w);
          work.push({ v: w, next: 0 });
          descended = true;
          break;
        }
        if (onStack.has(w)) {
          low.set(frame.v, Math.min(low.get(frame.v) ?? 0, index.get(w) ?? 0));
        }
      }
      if (descended) continue;
      const v = frame.v;
      if ((low.get(v) ?? 0) === (index.get(v) ?? 0)) {
        const comp: string[] = [];
        for (;;) {
          const w = stack.pop();
          if (w === undefined) break;
          onStack.delete(w);
          comp.push(w);
          if (w === v) break;
        }
        out.push(comp);
      }
      work.pop();
      // The `low.set(parent, min(parent, child))` the recursive form did on return.
      const parent = work[work.length - 1];
      if (parent) low.set(parent.v, Math.min(low.get(parent.v) ?? 0, low.get(v) ?? 0));
    }
  };

  for (const v of nodes) if (inSub(v) && !index.has(v)) strongConnect(v);
  return out;
};

/**
 * Find every simple directed cycle (elementary circuit) in the doc's edge
 * graph. Each cycle is returned as an ordered list of entity ids `[a, b, c]`
 * representing the directed walk `a → b → c → a` (the closing edge back to the
 * first entry is implicit), rotated so the smallest entity id leads — a
 * canonical form `effectiveBackEdgeIds` (`backEdges.ts`) relies on to pick each
 * loop's closer deterministically. Returns an empty array on an acyclic graph.
 *
 * Session 206 — rewritten as **Tarjan SCC + Johnson's algorithm**. The previous
 * DFS-with-stack walk reported a *cycle basis*, not every simple cycle: it
 * marked nodes `visited` globally and never unmarked them, so a second cycle
 * arriving at an already-finished node found nothing on the recursion stack and
 * was silently dropped. Two loops sharing a closing edge (`a→b→c→a` plus
 * `a→d→c→a`) therefore reported only one, and `loopsWithPolarity` — R/B loop
 * detection — inherited the blind spot.
 *
 * Johnson is complete by construction: vertices are searched in a fixed order,
 * and for each start `s` only the subgraph on `{s…n}` is considered, so every
 * circuit is enumerated exactly once — when `s` is its minimum vertex. Since the
 * order here is the sorted entity ids, each circuit therefore comes out already
 * rotated to start at its smallest id, which IS the canonical form above. The
 * blocking map (`B`) is what keeps it from re-walking fruitless paths, giving
 * O((V+E)(C+1)) rather than the naive exponential search.
 *
 * See {@link MAX_CYCLES} for the degradation ceiling.
 */
// Session 135 / Perf #9 — WeakMap-cached on `doc.edges`. Cycle
// membership is a pure function of the edge topology, so it's stable
// until the edge map gets a new reference (any add / remove / re-point).
// Callers (e.g. `effectiveBackEdgeIds`) run this on each cache miss; the
// cache turns the enumeration into a one-time cost per edge-set.
const findCyclesCache = new WeakMap<TPDocument['edges'], string[][]>();

export const findCycles = (doc: TPDocument): string[][] => {
  const memo = findCyclesCache.get(doc.edges);
  if (memo) return memo;

  // Sorted ids ARE Johnson's vertex order, which is what makes every circuit
  // come out rooted at its smallest id (see the docblock).
  const nodes = Object.keys(doc.entities).sort();
  const nodeSet = new Set(nodes);
  const adj = new Map<string, string[]>();
  for (const id of nodes) adj.set(id, []);
  // Build adjacency from the cached `bySource` index rather than a
  // fresh edge-array scan.
  for (const [sourceId, outs] of edgeIndex(doc).bySource) {
    const list = adj.get(sourceId);
    if (!list) continue;
    const seen = new Set<string>();
    for (const e of outs) {
      // A cycle is a sequence of ENTITIES, so parallel edges a→b collapse to one
      // adjacency — otherwise Johnson would enumerate the same circuit twice.
      // A target that isn't an entity isn't a vertex of this graph at all.
      if (!nodeSet.has(e.targetId) || seen.has(e.targetId)) continue;
      seen.add(e.targetId);
      list.push(e.targetId);
    }
  }

  const cycles = new Map<string, string[]>();
  // Johnson's blocking state: `blocked` stops a vertex being re-entered on the
  // current root's search; `blockMap` (the paper's B) records who to release
  // when a vertex is unblocked, so a fruitless subtree is walked once, not once
  // per path that reaches it.
  const blocked = new Set<string>();
  const blockMap = new Map<string, Set<string>>();
  const path: string[] = [];
  let capped = false;

  /** Johnson's UNBLOCK, worklist form — depth here is bounded by the SCC size. */
  const unblock = (start: string): void => {
    const pending = [start];
    while (pending.length > 0) {
      const u = pending.pop();
      if (u === undefined) continue;
      blocked.delete(u);
      const waiting = blockMap.get(u);
      if (!waiting) continue;
      for (const w of [...waiting]) {
        waiting.delete(w);
        if (blocked.has(w)) pending.push(w);
      }
    }
  };

  /**
   * Johnson's CIRCUIT: extend `path` from `root`, recording every route back to
   * it. A frame's `found` decides whether its vertex is unblocked now or parked
   * on its successors' block lists.
   *
   * Iterative for the same reason as Tarjan above: recursion depth here is the
   * length of the simple path being explored, so a long cycle blew the stack —
   * a 4000-entity ring threw `RangeError` rather than returning a cycle.
   */
  const circuit = (root: string, scc: ReadonlySet<string>): void => {
    const frames: { v: string; next: number; found: boolean }[] = [
      { v: root, next: 0, found: false },
    ];
    path.push(root);
    blocked.add(root);

    while (frames.length > 0) {
      const frame = frames[frames.length - 1];
      if (!frame) break;
      const neighbours = adj.get(frame.v) ?? [];
      let descended = false;
      while (frame.next < neighbours.length && !capped) {
        const w = neighbours[frame.next];
        frame.next++;
        if (w === undefined || !scc.has(w)) continue;
        if (w === root) {
          const cycle = [...path];
          cycles.set(cycle.join('->'), cycle);
          frame.found = true;
          if (cycles.size >= MAX_CYCLES) capped = true;
          continue;
        }
        if (!blocked.has(w)) {
          path.push(w);
          blocked.add(w);
          frames.push({ v: w, next: 0, found: false });
          descended = true;
          break;
        }
      }
      if (descended && !capped) continue;
      if (capped) {
        // Unwind without bookkeeping — the enumeration is abandoned wholesale,
        // and `blocked` / `blockMap` are cleared before the next root anyway.
        while (frames.length > 0) {
          frames.pop();
          path.pop();
        }
        return;
      }
      if (frame.found) {
        unblock(frame.v);
      } else {
        // No circuit through `v` on this pass: park `v` on each successor's list
        // so it's reconsidered only if that successor ever unblocks.
        for (const w of neighbours) {
          if (!scc.has(w)) continue;
          let waiting = blockMap.get(w);
          if (!waiting) {
            waiting = new Set<string>();
            blockMap.set(w, waiting);
          }
          waiting.add(frame.v);
        }
      }
      path.pop();
      frames.pop();
      const parent = frames[frames.length - 1];
      if (parent && frame.found) parent.found = true;
    }
  };

  // SCCs are computed ONCE for the whole graph, not once per root.
  //
  // The previous loop ran a full Tarjan pass over `nodes.slice(s)` for every
  // vertex, making the whole thing O(V·(V+E)) — measured on a simple ACYCLIC
  // chain: 167 ms at n=1000, 1.7 s at n=3000, 11.7 s at n=7000, on a code path
  // that re-runs on every `doc.edges` change and feeds the canvas.
  //
  // Every elementary circuit lives inside one SCC, so partitioning up front is
  // enough. Restricting each root's search to `itsSCC ∩ {vertices ≥ root}` keeps
  // Johnson's "each circuit is enumerated exactly once, when its root is its
  // minimum vertex" guarantee — and therefore the canonical rotation callers
  // depend on. Not recomputing SCCs of that shrinking subgraph prunes slightly
  // less than the paper does, which costs blocked-set work in the rare
  // many-circuit case and saves a quadratic factor in every other.
  //
  // On an acyclic graph every SCC is a single vertex with no self-loop, so the
  // whole search short-circuits after one Tarjan pass.
  const orderIndex = new Map(nodes.map((id, i) => [id, i]));
  for (const component of stronglyConnectedComponents(nodes, adj, () => true)) {
    if (capped) break;
    const sorted = [...component].sort(
      (a, b) => (orderIndex.get(a) ?? 0) - (orderIndex.get(b) ?? 0)
    );
    // A one-vertex SCC hosts a circuit only through a self-loop.
    const only = sorted.length === 1 ? sorted[0] : undefined;
    if (only !== undefined && !(adj.get(only) ?? []).includes(only)) continue;
    for (let s = 0; s < sorted.length && !capped; s++) {
      const root = sorted[s];
      if (root === undefined) continue;
      const sccSet = new Set(sorted.slice(s));
      blocked.clear();
      blockMap.clear();
      circuit(root, sccSet);
    }
  }

  const result = [...cycles.values()];
  findCyclesCache.set(doc.edges, result);
  return result;
};
