/**
 * Edge-routing visibility graph + A\* — the Phase C router engine. Builds a
 * graph whose vertices are obstacle corners (4 per obstacle) connected wherever
 * the segment between them doesn't cross an obstacle's interior, then runs A\*
 * (euclidean heuristic) to find the shortest obstacle-free corner sequence
 * between an arbitrary source / target pair.
 *
 * Split out of `edgeRouting.ts` (Session 164). Pure geometry — no store, no
 * React. The graph is a reusable value (`buildVisibilityGraph` once per layout
 * pass) and `aStarOnGraph` runs per edge against it; `findVisibilityPath` is the
 * build-and-run convenience for single-edge callers.
 *
 * The flat `Float64Array` storage + the inlined `segmentCrossesBoxBounds`
 * (from `edgeGeometry`) keep the inner loop allocation-free — see the comments
 * on those for the perf rationale.
 */

import { type Box, OBSTACLE_PADDING, type Point, segmentCrossesBoxBounds } from './edgeGeometry';

/**
 * Reusable visibility-graph value. Vertices are the obstacle corners
 * (4 per obstacle), stored as parallel `Float64Array`s for cache-
 * friendly access; the adjacency lists are flat-array per-vertex.
 *
 * Construct once via {@link buildVisibilityGraph} and call
 * {@link aStarOnGraph} per edge to find the shortest path between
 * arbitrary source/target points.
 *
 * The flat-array representation deliberately exposes the storage
 * format — Phase D's per-layout cache reuses the same graph across
 * many A\* calls and shaving allocations on each path lookup matters.
 */
export type VisibilityGraph = {
  /** Total number of corner vertices in the graph. = 4 × obstacles.length. */
  readonly cornerCount: number;
  /** Corner x-coordinates, indexed 0…cornerCount-1. */
  readonly vx: Float64Array;
  /** Corner y-coordinates, indexed 0…cornerCount-1. */
  readonly vy: Float64Array;
  /** Per-corner adjacency: `adjIdx[i]` is the list of neighbor corner indices. */
  readonly adjIdx: readonly number[][];
  /** Per-corner adjacency edge weights matching {@link adjIdx}. */
  readonly adjW: readonly number[][];
  /** Shrunk-interior obstacle x-mins, used for visibility checks involving the source/target. */
  readonly oxmin: Float64Array;
  /** Shrunk-interior obstacle x-maxes. */
  readonly oxmax: Float64Array;
  /** Shrunk-interior obstacle y-mins. */
  readonly oymin: Float64Array;
  /** Shrunk-interior obstacle y-maxes. */
  readonly oymax: Float64Array;
  /** Obstacle count (= oxmin.length, etc.). */
  readonly obstacleCount: number;
};

/** Visibility check on flat arrays. Pulled out as a top-level helper
 *  so both graph construction and A\* extension can call it. The
 *  `excludeIdx0` / `excludeIdx1` parameters skip up to two specific
 *  obstacle indices — used in `aStarOnGraph` to exempt the source /
 *  target nodes' own boxes, since their handle positions sit inside
 *  the shrunk-interior bounds. Pass `-1` for unused exclude slots. */
const segmentVisible = (
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  oxmin: Float64Array,
  oxmax: Float64Array,
  oymin: Float64Array,
  oymax: Float64Array,
  m: number,
  excludeIdx0: number = -1,
  excludeIdx1: number = -1
): boolean => {
  for (let k = 0; k < m; k++) {
    if (k === excludeIdx0 || k === excludeIdx1) continue;
    if (
      segmentCrossesBoxBounds(
        sx,
        sy,
        tx,
        ty,
        oxmin[k] ?? 0,
        oxmax[k] ?? 0,
        oymin[k] ?? 0,
        oymax[k] ?? 0
      )
    ) {
      return false;
    }
  }
  return true;
};

/**
 * Build a {@link VisibilityGraph} from an obstacle list. The corners
 * of each obstacle are nudged outward by `padding`; pairs of corners
 * whose connecting segment doesn't cross any obstacle's shrunk
 * interior become graph edges with their euclidean distance as weight.
 *
 * Phase D — exported so `computeEdgeRoutes` can build the graph once
 * per layout pass and reuse it across many A\* calls. The expensive
 * O(n² m) work happens here; per-edge A\* is then cheap.
 */
export const buildVisibilityGraph = (
  obstacles: readonly Box[],
  padding: number = OBSTACLE_PADDING
): VisibilityGraph => {
  const m = obstacles.length;
  const cornerCount = m * 4;
  const vx = new Float64Array(cornerCount);
  const vy = new Float64Array(cornerCount);
  for (let i = 0; i < m; i++) {
    const o = obstacles[i];
    if (!o) continue;
    const left = o.x - padding;
    const right = o.x + o.width + padding;
    const top = o.y - padding;
    const bottom = o.y + o.height + padding;
    const base = i * 4;
    vx[base] = left;
    vy[base] = top;
    vx[base + 1] = right;
    vy[base + 1] = top;
    vx[base + 2] = left;
    vy[base + 2] = bottom;
    vx[base + 3] = right;
    vy[base + 3] = bottom;
  }
  // Shrunk-interior obstacle bounds for the visibility check. EPS
  // keeps corner-corner edges along a shared boundary visible.
  const EPS = 0.001;
  const oxmin = new Float64Array(m);
  const oxmax = new Float64Array(m);
  const oymin = new Float64Array(m);
  const oymax = new Float64Array(m);
  for (let i = 0; i < m; i++) {
    const o = obstacles[i];
    if (!o) continue;
    oxmin[i] = o.x - padding + EPS;
    oxmax[i] = o.x + o.width + padding - EPS;
    oymin[i] = o.y - padding + EPS;
    oymax[i] = o.y + o.height + padding - EPS;
  }
  // Adjacency build — O(n² m) once.
  const adjIdx: number[][] = new Array(cornerCount);
  const adjW: number[][] = new Array(cornerCount);
  for (let i = 0; i < cornerCount; i++) {
    adjIdx[i] = [];
    adjW[i] = [];
  }
  for (let i = 0; i < cornerCount; i++) {
    const sx = vx[i] ?? 0;
    const sy = vy[i] ?? 0;
    for (let j = i + 1; j < cornerCount; j++) {
      const tx = vx[j] ?? 0;
      const ty = vy[j] ?? 0;
      if (!segmentVisible(sx, sy, tx, ty, oxmin, oxmax, oymin, oymax, m)) continue;
      const w = Math.hypot(tx - sx, ty - sy);
      adjIdx[i]?.push(j);
      adjW[i]?.push(w);
      adjIdx[j]?.push(i);
      adjW[j]?.push(w);
    }
  }
  return { cornerCount, vx, vy, adjIdx, adjW, oxmin, oxmax, oymin, oymax, obstacleCount: m };
};

/**
 * Binary min-heap for the A\* open list, ordered by `(fScore, insertionSeq)`.
 *
 * Replaces the previous `Set` + per-pop O(V) linear scan (O(V²) overall) with
 * O(log V) push / pop. It is a *drop-in* for that scan — it reproduces the
 * exact same pop order, hence byte-identical routes (pinned by
 * `tests/domain/edgeRoutingAStarParity`). Two properties make that hold:
 *
 *   1. **Tie-break = insertion order.** The scan kept the FIRST minimum it met
 *      and a `Set` iterates in insertion order, so among equal fScores the
 *      earliest-inserted vertex won. Each entry carries its vertex's insertion
 *      sequence and ties on fScore break by it (smaller seq wins).
 *   2. **Decrease-key via lazy deletion.** When a vertex's fScore improves the
 *      caller pushes a fresh entry (reusing the vertex's original seq) and
 *      leaves the stale one; on pop it skips any entry whose vertex is already
 *      finalized. A vertex's lowest-fScore entry is always popped first, so
 *      its first pop is the live one — exactly what the scan would select.
 *
 * Entries live in three parallel arrays to avoid a per-entry object on this
 * hot path. Total pushes ≤ relaxations = O(E), so the arrays stay bounded.
 */
class AStarOpenHeap {
  private readonly fs: number[] = [];
  private readonly seqs: number[] = [];
  private readonly idxs: number[] = [];

  get size(): number {
    return this.fs.length;
  }

  /** Does entry `a` sort before entry `b`? Lower fScore, then lower seq. */
  private before(a: number, b: number): boolean {
    const fa = this.fs[a]!;
    const fb = this.fs[b]!;
    if (fa !== fb) return fa < fb;
    return this.seqs[a]! < this.seqs[b]!;
  }

  private swap(a: number, b: number): void {
    const f = this.fs[a]!;
    this.fs[a] = this.fs[b]!;
    this.fs[b] = f;
    const s = this.seqs[a]!;
    this.seqs[a] = this.seqs[b]!;
    this.seqs[b] = s;
    const i = this.idxs[a]!;
    this.idxs[a] = this.idxs[b]!;
    this.idxs[b] = i;
  }

  push(f: number, seq: number, idx: number): void {
    let c = this.fs.length;
    this.fs.push(f);
    this.seqs.push(seq);
    this.idxs.push(idx);
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (!this.before(c, p)) break;
      this.swap(c, p);
      c = p;
    }
  }

  /** Remove and return the min entry's vertex index. Caller ensures size > 0. */
  pop(): number {
    const top = this.idxs[0]!;
    const lastF = this.fs.pop()!;
    const lastSeq = this.seqs.pop()!;
    const lastIdx = this.idxs.pop()!;
    const n = this.fs.length;
    if (n > 0) {
      this.fs[0] = lastF;
      this.seqs[0] = lastSeq;
      this.idxs[0] = lastIdx;
      let p = 0;
      for (let l = 1; l < n; l = 2 * p + 1) {
        const r = l + 1;
        let m = this.before(l, p) ? l : p;
        if (r < n && this.before(r, m)) m = r;
        if (m === p) break;
        this.swap(p, m);
        p = m;
      }
    }
    return top;
  }
}

/**
 * Run A\* through a pre-built {@link VisibilityGraph} from `source`
 * to `target`. The graph carries only the obstacle corners; the
 * source and target are added on top as transient vertices, and
 * their visibility to each corner is checked on the fly. The A\*
 * heuristic is straight-line euclidean distance.
 *
 * Returns the shortest obstacle-free corner sequence (including
 * source as the first element and target as the last) or `null` if
 * no path exists.
 */
export const aStarOnGraph = (
  graph: VisibilityGraph,
  source: Point,
  target: Point,
  /**
   * Optional obstacle indices to skip in visibility checks. The
   * caller passes the indices of the source / target node's own
   * boxes — the handle positions sit on those boxes' boundaries
   * (= inside the shrunk-interior), so without this skip the source
   * couldn't see any corner outside its own box and A\* would fail.
   * Pass `-1` for unused slots; two slots is enough for typical
   * source+target exclusion.
   */
  excludeSourceBox: number = -1,
  excludeTargetBox: number = -1
): Point[] | null => {
  const cornerCount = graph.cornerCount;
  const m = graph.obstacleCount;
  // Vertex layout: [source, target, corner_0, corner_1, ...]
  const vertexCount = 2 + cornerCount;
  const SOURCE_IDX = 0;
  const TARGET_IDX = 1;

  // Reusable per-vertex coordinate accessors — source/target inlined,
  // corners via the graph's flat arrays.
  const getVx = (idx: number): number =>
    idx === SOURCE_IDX ? source.x : idx === TARGET_IDX ? target.x : (graph.vx[idx - 2] ?? 0);
  const getVy = (idx: number): number =>
    idx === SOURCE_IDX ? source.y : idx === TARGET_IDX ? target.y : (graph.vy[idx - 2] ?? 0);

  // Visibility between source/target and every corner. We don't add
  // these into the graph (would mutate the shared cache); instead
  // we keep two side arrays.
  const sourceToCornerW = new Float64Array(cornerCount);
  const targetToCornerW = new Float64Array(cornerCount);
  for (let k = 0; k < cornerCount; k++) {
    sourceToCornerW[k] = Number.POSITIVE_INFINITY;
    targetToCornerW[k] = Number.POSITIVE_INFINITY;
  }
  for (let k = 0; k < cornerCount; k++) {
    const cx = graph.vx[k] ?? 0;
    const cy = graph.vy[k] ?? 0;
    if (
      segmentVisible(
        source.x,
        source.y,
        cx,
        cy,
        graph.oxmin,
        graph.oxmax,
        graph.oymin,
        graph.oymax,
        m,
        excludeSourceBox,
        excludeTargetBox
      )
    ) {
      sourceToCornerW[k] = Math.hypot(cx - source.x, cy - source.y);
    }
    if (
      segmentVisible(
        target.x,
        target.y,
        cx,
        cy,
        graph.oxmin,
        graph.oxmax,
        graph.oymin,
        graph.oymax,
        m,
        excludeSourceBox,
        excludeTargetBox
      )
    ) {
      targetToCornerW[k] = Math.hypot(cx - target.x, cy - target.y);
    }
  }
  // Source→target direct visibility.
  const sourceToTargetW = segmentVisible(
    source.x,
    source.y,
    target.x,
    target.y,
    graph.oxmin,
    graph.oxmax,
    graph.oymin,
    graph.oymax,
    m,
    excludeSourceBox,
    excludeTargetBox
  )
    ? Math.hypot(target.x - source.x, target.y - source.y)
    : Number.POSITIVE_INFINITY;

  const gScore = new Float64Array(vertexCount);
  const fScore = new Float64Array(vertexCount);
  for (let i = 0; i < vertexCount; i++) {
    gScore[i] = Number.POSITIVE_INFINITY;
    fScore[i] = Number.POSITIVE_INFINITY;
  }
  const cameFrom = new Int32Array(vertexCount).fill(-1);
  gScore[SOURCE_IDX] = 0;
  fScore[SOURCE_IDX] = Math.hypot(target.x - source.x, target.y - source.y);

  // Open list as a (fScore, insertion-seq) min-heap — see AStarOpenHeap.
  // `seqOf` assigns each vertex an insertion rank the first time it enters the
  // open list, mirroring the previous `Set`'s insertion order so the tie-break
  // — and therefore the chosen route — stays byte-identical. `finalized` lets
  // the pop loop skip the stale duplicates a lazy decrease-key leaves behind.
  const open = new AStarOpenHeap();
  const seqOf = new Int32Array(vertexCount).fill(-1);
  const finalized = new Uint8Array(vertexCount);
  let seqCounter = 0;
  const openPush = (idx: number): void => {
    if (seqOf[idx] === -1) seqOf[idx] = seqCounter++;
    open.push(fScore[idx]!, seqOf[idx]!, idx);
  };
  openPush(SOURCE_IDX);

  // Returns the iterator over (neighborIdx, weight) for vertex `v`.
  // For the source / target we splice in the side arrays + the
  // direct source-target edge; for corners we read from the graph.
  const iterateNeighbors = (
    v: number,
    visit: (neighborIdx: number, weight: number) => void
  ): void => {
    if (v === SOURCE_IDX) {
      for (let k = 0; k < cornerCount; k++) {
        const w = sourceToCornerW[k] ?? Number.POSITIVE_INFINITY;
        if (Number.isFinite(w)) visit(2 + k, w);
      }
      if (Number.isFinite(sourceToTargetW)) visit(TARGET_IDX, sourceToTargetW);
      return;
    }
    if (v === TARGET_IDX) {
      for (let k = 0; k < cornerCount; k++) {
        const w = targetToCornerW[k] ?? Number.POSITIVE_INFINITY;
        if (Number.isFinite(w)) visit(2 + k, w);
      }
      if (Number.isFinite(sourceToTargetW)) visit(SOURCE_IDX, sourceToTargetW);
      return;
    }
    // Corner vertex.
    const cornerIdx = v - 2;
    const neighbors = graph.adjIdx[cornerIdx];
    const weights = graph.adjW[cornerIdx];
    if (neighbors && weights) {
      for (let i = 0; i < neighbors.length; i++) {
        const ni = neighbors[i];
        const w = weights[i];
        if (ni !== undefined && w !== undefined) visit(2 + ni, w);
      }
    }
    // Plus the back-edges to source/target if reachable.
    const wToSource = sourceToCornerW[cornerIdx] ?? Number.POSITIVE_INFINITY;
    if (Number.isFinite(wToSource)) visit(SOURCE_IDX, wToSource);
    const wToTarget = targetToCornerW[cornerIdx] ?? Number.POSITIVE_INFINITY;
    if (Number.isFinite(wToTarget)) visit(TARGET_IDX, wToTarget);
  };

  while (open.size > 0) {
    const best = open.pop();
    // Skip stale duplicates left by a lazy decrease-key: a vertex's live
    // (lowest-fScore) entry is always popped first, so once it is finalized
    // any later entry for it is obsolete. This is what keeps the pop order —
    // and therefore the route — identical to the old linear scan over `open`.
    if (finalized[best]) continue;
    if (best === TARGET_IDX) {
      // Reconstruct the path.
      const path: Point[] = [];
      let cursor: number = best;
      while (cursor !== -1) {
        path.push({ x: getVx(cursor), y: getVy(cursor) });
        cursor = cameFrom[cursor] ?? -1;
      }
      path.reverse();
      return path;
    }
    finalized[best] = 1;
    const gBest = gScore[best] ?? Number.POSITIVE_INFINITY;
    iterateNeighbors(best, (neighborIdx, weight) => {
      const tentativeG = gBest + weight;
      const currentG = gScore[neighborIdx] ?? Number.POSITIVE_INFINITY;
      if (tentativeG < currentG) {
        cameFrom[neighborIdx] = best;
        gScore[neighborIdx] = tentativeG;
        fScore[neighborIdx] =
          tentativeG + Math.hypot(target.x - getVx(neighborIdx), target.y - getVy(neighborIdx));
        openPush(neighborIdx);
      }
    });
  }
  return null;
};

/**
 * Convenience wrapper — builds a fresh graph and runs A\* on it. Used
 * by single-edge callers (e.g. tests, the `routeEdge` shortcut path)
 * that don't need the caching benefit.
 *
 * For multi-edge layouts, prefer {@link buildVisibilityGraph} +
 * {@link aStarOnGraph} so the O(n²m) graph construction amortises
 * across edges.
 */
export const findVisibilityPath = (
  source: Point,
  target: Point,
  obstacles: readonly Box[],
  padding: number = OBSTACLE_PADDING
): Point[] | null => {
  const graph = buildVisibilityGraph(obstacles, padding);
  return aStarOnGraph(graph, source, target);
};
