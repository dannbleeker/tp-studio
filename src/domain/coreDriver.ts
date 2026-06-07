import {
  entitiesOfType,
  getEntity,
  incomingEdges,
  isAssumption,
  reachableBackward,
  reachableForward,
  structuralEntities,
} from './graph';
import type { Entity, TPDocument } from './types';

/**
 * "Core Driver" finder — the headline deliverable a CRT exists to produce.
 *
 * Per Goldratt's CRT method: the Core Driver is the single root cause that
 * influences the most critical Undesirable Effects. Identifying it is
 * supposed to be CRT Step 9 — the *point* of having drawn the tree.
 *
 * This module ranks candidate root causes by their forward reach into UDE
 * entities and returns the top few. We don't try to nominate THE single
 * Core Driver — if multiple candidates score close together that's
 * genuinely informative for the user; if one dominates, it shows up alone
 * at the top of the list.
 *
 * "Root cause" candidate selection:
 *   1. If the document has explicit `rootCause`-typed entities, those are
 *      the candidate pool (the user has already done the typing work).
 *   2. Otherwise, fall back to "any structural entity with no structural
 *      incoming edges" — entities at the bottom of the causal graph.
 *
 * Assumptions are excluded both as candidates and from the reach count.
 */

export type CoreDriverCandidate = {
  entity: Entity;
  /** Number of UDE entities transitively reachable via outgoing edges. */
  reachedUdeCount: number;
  /** The reached UDE ids, ordered by annotation number for stable display. */
  reachedUdeIds: string[];
};

const filterStructural = (doc: TPDocument, ids: Iterable<string>): string[] => {
  const out: string[] = [];
  for (const id of ids) {
    const e = getEntity(doc, id);
    if (e && !isAssumption(e)) out.push(id);
  }
  return out;
};

/**
 * Compute, for every structural entity, how many UDE entities it transitively
 * reaches via outgoing edges. Used both by the Core Driver finder and by the
 * Reach badge overlay. Returns a map keyed by entity id; entities reaching
 * zero UDEs are omitted (the UI treats "no entry" as "nothing to show").
 *
 * Cost: O(V × (V + E)) — one BFS per structural entity. Fine on any graph a
 * human is going to hand-build (the suite stays sub-millisecond on 200-node
 * test graphs); we'll cache by `layoutFingerprint` if profiles ever show
 * this in the hot path.
 */
/**
 * Session 135 / Perf #20 — both reach maps are pure functions of the
 * entity set (which entities are UDE / rootCause + the structural
 * filter) and the edge topology, so they're cached on a nested
 * `(entities, edges)` WeakMap. This matters because
 * `useGraphNodeEmission` calls them on every emission — and the
 * emission memo's deps include `positions`, so without the cache the
 * O(V·(V+E)) BFS re-ran on every drag frame even though the topology
 * was unchanged. A reference hit means "graph unchanged → reuse".
 */
const udeReachCache = new WeakMap<
  TPDocument['entities'],
  WeakMap<TPDocument['edges'], Map<string, number>>
>();
const rootCauseReachCache = new WeakMap<
  TPDocument['entities'],
  WeakMap<TPDocument['edges'], Map<string, number>>
>();

const reachCacheGet = (
  cache: WeakMap<TPDocument['entities'], WeakMap<TPDocument['edges'], Map<string, number>>>,
  doc: TPDocument
): Map<string, number> | undefined => cache.get(doc.entities)?.get(doc.edges);

const reachCacheSet = (
  cache: WeakMap<TPDocument['entities'], WeakMap<TPDocument['edges'], Map<string, number>>>,
  doc: TPDocument,
  value: Map<string, number>
): void => {
  let byEdges = cache.get(doc.entities);
  if (!byEdges) {
    byEdges = new WeakMap();
    cache.set(doc.entities, byEdges);
  }
  byEdges.set(doc.edges, value);
};

export const udeReachCounts = (doc: TPDocument): Map<string, number> => {
  const cached = reachCacheGet(udeReachCache, doc);
  if (cached) return cached;
  const out = new Map<string, number>();
  const udeIds = new Set<string>();
  for (const e of Object.values(doc.entities)) {
    if (e.type === 'ude') udeIds.add(e.id);
  }
  if (udeIds.size === 0) {
    reachCacheSet(udeReachCache, doc, out);
    return out;
  }
  for (const e of structuralEntities(doc)) {
    const reach = reachableForward(doc, [e.id]);
    let count = 0;
    for (const id of reach) if (udeIds.has(id)) count++;
    if (count > 0) out.set(e.id, count);
  }
  reachCacheSet(udeReachCache, doc, out);
  return out;
};

/**
 * Reverse counterpart of {@link udeReachCounts}: for each structural
 * entity, how many `rootCause` entities transitively feed it via
 * INCOMING edges. The "←N root causes" badge surfaces this on the
 * canvas so the user can see at a glance how many distinct origin
 * points an effect / UDE depends on.
 *
 * E2: originally deferred because most CRT entities have ≈1 root
 * cause feeding them. The badge is opt-in via Settings and hidden on
 * diagrams without `rootCause` entities (FRT / PRT / TT / EC), so
 * the clutter only appears where it carries signal — typically
 * Goal Trees and Future Reality Trees with multiple injections
 * converging onto an IO.
 */
export const rootCauseReachCounts = (doc: TPDocument): Map<string, number> => {
  const cached = reachCacheGet(rootCauseReachCache, doc);
  if (cached) return cached;
  const out = new Map<string, number>();
  const rootIds = new Set<string>();
  for (const e of Object.values(doc.entities)) {
    if (e.type === 'rootCause') rootIds.add(e.id);
  }
  if (rootIds.size === 0) {
    reachCacheSet(rootCauseReachCache, doc, out);
    return out;
  }
  for (const e of structuralEntities(doc)) {
    // Skip root causes themselves — they feed nothing themselves; the
    // badge would always read ←1 (the entity itself) which is noise.
    if (e.type === 'rootCause') continue;
    const reach = reachableBackward(doc, [e.id]);
    let count = 0;
    for (const id of reach) if (rootIds.has(id)) count++;
    if (count > 0) out.set(e.id, count);
  }
  reachCacheSet(rootCauseReachCache, doc, out);
  return out;
};

const coreDriverCache = new WeakMap<TPDocument, CoreDriverCandidate[]>();

/**
 * Cached wrapper — `findCoreDrivers` is pure in `doc`, and a single validation
 * pass calls it from two CRT rules (low-coverage + tied-drivers) plus the Core
 * Driver panel. Keying on the doc reference makes the repeat calls within one
 * pass O(1). (`udeReachCounts` it depends on is already cached on
 * entities/edges; this caches the additional per-candidate forward walk.)
 */
export const findCoreDrivers = (doc: TPDocument): CoreDriverCandidate[] => {
  const cached = coreDriverCache.get(doc);
  if (cached) return cached;
  const result = computeCoreDrivers(doc);
  coreDriverCache.set(doc, result);
  return result;
};

/**
 * Pick the top-scoring Core Driver candidates from the document. Returns
 * `[]` when there are no UDEs (the concept doesn't apply outside CRT-like
 * diagrams) or when no candidate root cause reaches any UDE (a disconnected
 * scaffold). At most 3 entries; ties at the boundary may push beyond 3 only
 * when many candidates literally tie for top.
 */
const computeCoreDrivers = (doc: TPDocument): CoreDriverCandidate[] => {
  const counts = udeReachCounts(doc);
  if (counts.size === 0) return [];

  // Pool: explicit rootCause entities if any exist, otherwise structural
  // leaves (no structural incoming).
  const explicit: Entity[] = [];
  for (const e of structuralEntities(doc)) {
    if (e.type === 'rootCause') explicit.push(e);
  }
  let pool: Entity[];
  if (explicit.length > 0) {
    pool = explicit;
  } else {
    pool = [];
    for (const e of structuralEntities(doc)) {
      const ins = filterStructural(
        doc,
        incomingEdges(doc, e.id).map((edge) => edge.sourceId)
      );
      if (ins.length === 0) pool.push(e);
    }
  }

  const udeIds = new Set(entitiesOfType(doc, 'ude').map((e) => e.id));

  const scored: CoreDriverCandidate[] = pool
    // Session 135 / Perf #21 — reuse the cached `counts` map: a pool
    // candidate absent from it reaches zero UDEs, so skip the (now
    // redundant) forward BFS for it entirely. Candidates that DO reach
    // a UDE still need the walk to recover the ordered `reachedUdeIds`.
    .filter((entity) => counts.has(entity.id))
    .map((entity) => {
      const reach = reachableForward(doc, [entity.id]);
      const reachedUdeIds: string[] = [];
      // `reach` now carries `EntityId` natively (see graph.ts), so no
      // cast is needed against the `Set<EntityId>` UDE lookup.
      for (const id of reach) if (udeIds.has(id)) reachedUdeIds.push(id);
      reachedUdeIds.sort(
        (a, b) =>
          (getEntity(doc, a)?.annotationNumber ?? 0) - (getEntity(doc, b)?.annotationNumber ?? 0)
      );
      return { entity, reachedUdeCount: reachedUdeIds.length, reachedUdeIds };
    })
    .filter((c) => c.reachedUdeCount > 0);

  scored.sort((a, b) => {
    if (b.reachedUdeCount !== a.reachedUdeCount) return b.reachedUdeCount - a.reachedUdeCount;
    return a.entity.annotationNumber - b.entity.annotationNumber;
  });

  // Cutoff rule: keep everything tied for top, plus anything within one UDE
  // of the top score; cap at 3 unless the top tier itself is wider. This
  // surfaces "clear winner" cases as a single result and "close call" cases
  // as a small comparison set.
  const top = scored[0]?.reachedUdeCount ?? 0;
  const filtered = scored.filter((c) => c.reachedUdeCount >= top - 1);
  return filtered.slice(0, Math.max(3, filtered.filter((c) => c.reachedUdeCount === top).length));
};
