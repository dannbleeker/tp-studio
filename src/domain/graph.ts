// Pure graph queries over a TPDocument. No React, no store, no DOM —
// safe to use from validators, store actions, services, and tests.

import type { Assumption, Edge, Entity, EntityId, EntityType, TPDocument } from './types';

/**
 * Session 105 / Tier 1 #3 — cached `Object.values(doc.edges)`.
 *
 * The edges-array materialization shows up dozens of times across the
 * validators, the layout pipeline, the verbalisation generator, the
 * exporters, and the canvas render path. Each call allocates a fresh
 * array — cheap individually, expensive in aggregate when the same
 * doc state is queried 30+ times per render frame.
 *
 * The store uses immutable updates, so `doc.edges` is a stable
 * reference until the edge map actually changes. A `WeakMap` keyed
 * on that reference returns the same array across all callers within
 * the same doc state, with no manual cache invalidation: when the
 * edges map gets a new reference (on add / remove / update), the
 * old map drops out of the WeakMap on the next GC pass.
 *
 * Callers that mutate the result are violating the contract — the
 * array is `readonly` to enforce that at the type level. If you need
 * to filter / sort, `Array.from(edgesArray(doc))` or a `.filter`
 * chain produces a fresh array without busting the cache.
 */
const edgesArrayCache = new WeakMap<TPDocument['edges'], readonly Edge[]>();

export const edgesArray = (doc: TPDocument): readonly Edge[] => {
  let cached = edgesArrayCache.get(doc.edges);
  if (cached === undefined) {
    cached = Object.values(doc.edges);
    edgesArrayCache.set(doc.edges, cached);
  }
  return cached;
};

/**
 * Symmetric helper for entities. Identical caching strategy.
 * See `edgesArray` for the full rationale.
 */
const entitiesArrayCache = new WeakMap<TPDocument['entities'], readonly Entity[]>();

export const entitiesArray = (doc: TPDocument): readonly Entity[] => {
  let cached = entitiesArrayCache.get(doc.entities);
  if (cached === undefined) {
    cached = Object.values(doc.entities);
    entitiesArrayCache.set(doc.entities, cached);
  }
  return cached;
};

/**
 * Session 135 / Perf #1 — per-doc-reference edge index.
 *
 * `incomingEdges` / `outgoingEdges` were the highest-frequency
 * O(E) call in the codebase: every validator that loops entities
 * called them once per entity, turning N entities × E edges into a
 * cumulative O(N·E) scan. `edgesArray(doc)` already cached the array
 * itself, but each filter call still walked every edge.
 *
 * The fix is a single forward pass per doc reference that builds two
 * indices keyed by `sourceId` and `targetId`. Lookups against the
 * indices are O(1) array fetches (matching the existing
 * `entitiesByType` pattern). Cache invalidation is automatic via
 * `WeakMap` keyed on the doc's edges reference — the store's
 * immutable updates produce a new edges-map reference on every
 * mutation, so the next call rebuilds. Old refs GC normally.
 *
 * The returned arrays are `readonly` to enforce non-mutation: callers
 * that need to sort/filter must `.slice()` first or use `Array.from`.
 * `incomingEdges` / `outgoingEdges` return the cached array directly
 * (not a defensive copy) because the typing prevents the dozens of
 * callers from mutating it; the wins from sharing references outweigh
 * the (very small) blast radius if a caller ignores `readonly`.
 *
 * Estimated impact (per Session-135 bench): tautology rule drops
 * from ~217µs to ~80µs at 100 entities; the saving scales linearly
 * with entity count and dominates as the graph grows.
 */
type EdgeIndex = {
  bySource: ReadonlyMap<string, readonly Edge[]>;
  byTarget: ReadonlyMap<string, readonly Edge[]>;
};

const EMPTY_EDGE_LIST: readonly Edge[] = Object.freeze([]) as readonly Edge[];

const edgeIndexCache = new WeakMap<TPDocument['edges'], EdgeIndex>();

/**
 * Narrow shape accepted by the edge-index helpers: anything carrying an
 * `edges` map. Lets callers that only hold the `{ entities, edges }`
 * slice (the propagation engine, action-eligibility) reuse the same
 * per-`doc.edges` cache without lifting the whole document into scope.
 */
type EdgesHost = Pick<TPDocument, 'edges'>;

const buildEdgeIndex = (edges: TPDocument['edges']): EdgeIndex => {
  const bySource = new Map<string, Edge[]>();
  const byTarget = new Map<string, Edge[]>();
  for (const edge of Object.values(edges)) {
    let outs = bySource.get(edge.sourceId);
    if (!outs) {
      outs = [];
      bySource.set(edge.sourceId, outs);
    }
    outs.push(edge);
    let ins = byTarget.get(edge.targetId);
    if (!ins) {
      ins = [];
      byTarget.set(edge.targetId, ins);
    }
    ins.push(edge);
  }
  return { bySource, byTarget };
};

const edgeIndex = (doc: EdgesHost): EdgeIndex => {
  let cached = edgeIndexCache.get(doc.edges);
  if (cached === undefined) {
    cached = buildEdgeIndex(doc.edges);
    edgeIndexCache.set(doc.edges, cached);
  }
  return cached;
};

/**
 * Session 108 → Session 135 — these helpers were O(E) per call
 * (filter over `edgesArray`); now O(1) via the per-doc edge index
 * above. Existing call shapes unchanged so the 40+ callers across
 * validators, exporters, layout, and inspector keep working without
 * edits. Returns the indexed cached array (typed `readonly`) — the
 * old `Edge[]` return type became `readonly Edge[]`. Two callers
 * (`reachableForward` / `reachableBackward`'s spread-into-queue and
 * `findPath`'s `.map`) consume the value as iterable, both safe.
 */
export const incomingEdges = (doc: EdgesHost, entityId: string): readonly Edge[] =>
  edgeIndex(doc).byTarget.get(entityId) ?? EMPTY_EDGE_LIST;

export const outgoingEdges = (doc: EdgesHost, entityId: string): readonly Edge[] =>
  edgeIndex(doc).bySource.get(entityId) ?? EMPTY_EDGE_LIST;

export const connectionCount = (doc: TPDocument, entityId: string): number =>
  incomingEdges(doc, entityId).length + outgoingEdges(doc, entityId).length;

// Session 135 / Perf #10 — O(1) via the cached `bySource` index
// instead of an O(E) `.some` scan over the whole edge array. Matters
// for callers that probe many pairs in a loop (e.g. the EC mutex /
// duplicate-edge guards).
export const hasEdge = (doc: TPDocument, sourceId: string, targetId: string): boolean =>
  (edgeIndex(doc).bySource.get(sourceId) ?? EMPTY_EDGE_LIST).some((e) => e.targetId === targetId);

export const isAssumption = (entity: Entity): boolean => entity.type === 'assumption';

/**
 * FL-ET7: `Note` entities are free-form annotations. They render on the
 * canvas as their own (yellow-stripe) cards but never participate in
 * edges, never feed CLR rules, and never appear in causality exports.
 * Pair with {@link isAssumption}; both are "structural noise" relative
 * to the causality graph.
 */
export const isNote = (entity: Entity): boolean => entity.type === 'note';

/**
 * `assumption` OR `note` — the two entity types that exist outside the
 * causal graph. Helpers iterating "every causally-meaningful entity"
 * should filter via this predicate so future non-causal types stay one
 * change away.
 */
export const isNonCausal = (entity: Entity): boolean => isAssumption(entity) || isNote(entity);

/**
 * Session 132 / Tier 3 #28 — per-doc-reference index of entities by
 * type. The `structuralEntities` + `entitiesArray` caches give us
 * O(1) access to the array, but every "give me the goals" or
 * "give me the injections" caller still pays O(n) to refilter on
 * each call. Building the by-type map once per doc state moves
 * those queries to O(1) at the cost of one extra pass when the doc
 * mutates.
 *
 * Hot callers: the Goal Tree multi-goal validator (per validate
 * cycle), CoreDriver's UDE lookup (per warnings re-compute), the
 * EC InjectionWorkbench + ECInjectionChip selectors (per doc-store
 * emission while editing an EC), and the reasoning/HTML exporters.
 *
 * Cache invalidation: keyed on `doc.entities` reference, same
 * strategy as `entitiesArray` / `structuralEntities`. The store's
 * immutable updates produce a new reference on every entity
 * mutation, so the next call rebuilds; intermediate reads share
 * the cache.
 *
 * The returned arrays are `readonly`. Callers that need to sort
 * must copy via `.slice()` first — sorting in-place would mutate
 * the cache.
 */
const entitiesByTypeCache = new WeakMap<
  TPDocument['entities'],
  ReadonlyMap<EntityType, readonly Entity[]>
>();

export const entitiesByType = (doc: TPDocument): ReadonlyMap<EntityType, readonly Entity[]> => {
  const cached = entitiesByTypeCache.get(doc.entities);
  if (cached) return cached;
  const map = new Map<EntityType, Entity[]>();
  for (const e of Object.values(doc.entities)) {
    let arr = map.get(e.type);
    if (!arr) {
      arr = [];
      map.set(e.type, arr);
    }
    arr.push(e);
  }
  const frozen: ReadonlyMap<EntityType, readonly Entity[]> = map;
  entitiesByTypeCache.set(doc.entities, frozen);
  return frozen;
};

/**
 * Convenience: the array of entities with the given type. Empty
 * tuple when no entity of that type exists; the same empty array
 * reference is returned on every "missing type" call to keep the
 * caller's referential-equality checks stable.
 */
const EMPTY_TYPE_RESULT: readonly Entity[] = Object.freeze([]) as readonly Entity[];

export const entitiesOfType = (doc: TPDocument, type: EntityType): readonly Entity[] =>
  entitiesByType(doc).get(type) ?? EMPTY_TYPE_RESULT;

// Session 85 — per-doc-reference memo. `structuralEntities` is called
// from 44+ sites (validators, exporters, emission, inspector, layout,
// CoreDriver, htmlExport, dotExport, edgeReading, …) — typically
// several times per render. Keyed by the doc REFERENCE because
// `applyDocChange` returns a new reference on every mutation, so a
// cache hit means "doc unchanged since last call" — same semantics as
// the layout fingerprint, just for the structural-filter answer.
// WeakMap so old doc references GC normally.
const structuralEntitiesCache = new WeakMap<TPDocument, Entity[]>();
export const structuralEntities = (doc: TPDocument): Entity[] => {
  const cached = structuralEntitiesCache.get(doc);
  if (cached) return cached;
  const result = Object.values(doc.entities).filter((e) => !isNonCausal(e));
  structuralEntitiesCache.set(doc, result);
  return result;
};

/**
 * Session 76 — reserved attribute keys recognized by the first-class
 * Strategy & Tactics node renderer. When an `injection` entity in an
 * `'st'` diagram carries any of these attributes, TPNode renders the
 * tall 5-row card (NA / Strategy / PA / Tactic / SA) instead of the
 * standard one-line layout. The Tactic row is the entity's `title`;
 * the four others are pulled from these attributes. See
 * {@link isStNodeFormat}.
 *
 * Keys are stable strings — they're part of the JSON wire format the
 * moment a user fills any of them in. Don't rename them.
 */
export const ST_FACET_KEYS = {
  strategy: 'stStrategy',
  necessaryAssumption: 'stNecessaryAssumption',
  parallelAssumption: 'stParallelAssumption',
  sufficiencyAssumption: 'stSufficiencyAssumption',
} as const;

const ST_FACET_KEY_VALUES: readonly string[] = Object.values(ST_FACET_KEYS);

/**
 * Returns true when an entity should render as a first-class S&T node
 * (the multi-row 5-facet card). Triggered by ANY of the four facet
 * attributes being set — partial fills still render the card so the
 * user sees the missing rows as a visible nudge to complete them.
 *
 * Note: this is intentionally lax about diagram type. The S&T renderer
 * works equally well on a CRT or FRT if the user wants to embed an S&T
 * cell in a different tree, and gating it strictly by `diagramType ===
 * 'st'` would surprise users who paste S&T entities into a CRT.
 */
export const isStNodeFormat = (entity: Entity): boolean => {
  const attrs = entity.attributes;
  if (!attrs) return false;
  if (entity.type !== 'injection') return false;
  return ST_FACET_KEY_VALUES.some((k) => attrs[k] !== undefined);
};

/**
 * Look up an entity by id. Takes a plain `string` (the graph helpers and
 * many call sites carry ids that came from outside the branded-id system
 * — React Flow, the URL, file pickers, BFS reach sets) and indexes the
 * record with a single internal cast so the call site stays clean.
 *
 * Returns `undefined` when the id isn't in the doc; callers should treat
 * a missing entity as "skip" rather than throwing.
 */
export const getEntity = (doc: TPDocument, id: string): Entity | undefined =>
  doc.entities[id as EntityId];

/**
 * LA5 pinned-entity filter. An entity is "pinned" iff it carries a stored
 * `Entity.position` that the auto-layout pipeline should honor as a fixed
 * coordinate. Called by:
 *
 *   - `useGraphPositions` (cache-key hash so a pin move re-runs the overlay)
 *   - `fingerprint.layoutFingerprint` (per-doc invalidation key)
 *   - the "Reset layout" palette command (count for the confirm prompt)
 *
 * Centralizing the rule means a future schema change (e.g. distinguishing
 * "pinned" from "dragged but not yet committed") only has to update one
 * helper.
 */
// Session 135 / Perf #11 — WeakMap-cached on `doc.entities`. Called
// per render from `useGraphPositions` AND both fingerprints (the
// layout-key build runs it unconditionally each render); the immutable
// store update gives a new entities reference exactly when a pin moves,
// so the cache invalidates precisely when it must.
const pinnedEntitiesCache = new WeakMap<TPDocument['entities'], Entity[]>();
export const pinnedEntities = (doc: TPDocument): Entity[] => {
  const cached = pinnedEntitiesCache.get(doc.entities);
  if (cached) return cached;
  const result = Object.values(doc.entities).filter((e) => e.position !== undefined);
  pinnedEntitiesCache.set(doc.entities, result);
  return result;
};

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
  while (queue.length) {
    const id = queue.shift()!;
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
  while (queue.length) {
    const id = queue.shift()!;
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
    while (queue.length) {
      const cur = queue.shift()!;
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
 * Used by Block C / E3 to surface back-edge warnings; the rule emits one
 * warning per cycle targeting the edge that closes it.
 */
// Session 135 / Perf #9 — WeakMap-cached on `doc.edges`. Cycle
// membership is a pure function of the edge topology, so it's stable
// until the edge map gets a new reference (any add / remove / re-point).
// `cycleRule` runs this on every validate-cache miss; the cache turns
// the DFS into a one-time cost per edge-set.
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
  const onStack = new Set<string>();
  const stack: string[] = [];

  const dfs = (id: string): void => {
    visited.add(id);
    onStack.add(id);
    stack.push(id);
    for (const next of adj.get(id) ?? []) {
      if (!visited.has(next)) {
        dfs(next);
      } else if (onStack.has(next)) {
        // Back-edge: the slice from `next` to the top of the stack is a cycle.
        const startIdx = stack.indexOf(next);
        if (startIdx >= 0) {
          const cycle = canonicalize(stack.slice(startIdx));
          cycles.set(cycle.join('->'), cycle);
        }
      }
    }
    onStack.delete(id);
    stack.pop();
  };

  for (const id of adj.keys()) {
    if (!visited.has(id)) dfs(id);
  }

  const result = [...cycles.values()];
  findCyclesCache.set(doc.edges, result);
  return result;
};

export const removeEntityFromEdges = (doc: TPDocument, entityId: string): Record<string, Edge> => {
  const branded = entityId as EntityId;
  // Session 108 — `edgesArray(doc)` returns the cached snapshot; the
  // store mutation that calls us then creates a NEW edges record
  // (via the spread below), so we're not violating the readonly
  // contract — we only read from the cache, never mutate it.
  const surviving = edgesArray(doc).filter((e) => e.sourceId !== branded && e.targetId !== branded);
  const result: Record<string, Edge> = {};
  for (const edge of surviving) {
    if (!edge.assumptionIds?.includes(branded)) {
      result[edge.id] = edge;
      continue;
    }
    const filtered = edge.assumptionIds.filter((a) => a !== branded);
    if (filtered.length) {
      result[edge.id] = { ...edge, assumptionIds: filtered };
    } else {
      // Omit the field rather than setting `assumptionIds: undefined`
      // (exactOptionalPropertyTypes rejects explicit undefined).
      const { assumptionIds: _drop, ...rest } = edge;
      result[edge.id] = rest;
    }
  }
  return result;
};

/**
 * Prune the first-class `doc.assumptions` map against a POST-deletion set of
 * surviving edges + entities:
 *   - drop any Assumption whose host edge no longer exists (an orphan — the
 *     causal link it annotated is gone), and
 *   - scrub any `injectionIds` entry that no longer resolves to an entity.
 *
 * Without this, deleting an edge or an entity (which cascades to its edges)
 * leaves dangling Assumption records that accumulate unbounded and survive
 * JSON export / share-link round-trips. Undo is unaffected — history stores
 * full doc snapshots, so an undo restores the pruned records.
 *
 * Returns the SAME reference when nothing changed (including the
 * no-assumptions case), so callers can spread it conditionally without
 * forcing a needless new object.
 */
export const pruneAssumptions = (
  assumptions: Record<string, Assumption> | undefined,
  survivingEdges: Record<string, Edge>,
  survivingEntities: Record<string, Entity>
): Record<string, Assumption> | undefined => {
  if (!assumptions) return assumptions;
  let changed = false;
  const next: Record<string, Assumption> = {};
  for (const [id, a] of Object.entries(assumptions)) {
    if (!survivingEdges[a.edgeId]) {
      // Host edge gone → orphaned assumption.
      changed = true;
      continue;
    }
    if (a.injectionIds && a.injectionIds.length > 0) {
      const filtered = a.injectionIds.filter((eid) => survivingEntities[eid]);
      if (filtered.length !== a.injectionIds.length) {
        changed = true;
        if (filtered.length > 0) {
          next[id] = { ...a, injectionIds: filtered };
        } else {
          // emit-or-omit: drop the field rather than store an empty array
          // (mirrors `removeEntityFromEdges` above).
          const { injectionIds: _drop, ...rest } = a;
          next[id] = rest;
        }
        continue;
      }
    }
    next[id] = a;
  }
  return changed ? next : assumptions;
};
