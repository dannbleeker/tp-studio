// Pure graph primitives over a TPDocument — the cached array/index/by-type
// lookups + the entity predicates. No React, no store, no DOM. A dependency-
// free leaf (imports only `./types`), so the reach-algorithm + prune helpers
// (`graphReach.ts`, `graphPrune.ts`) build on it without a cycle, and `graph.ts`
// re-exports the public surface as a barrel.
//
// Split out of `graph.ts` (Session 165).

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
 * The junctor (AND/OR/XOR) group id an edge belongs to, or undefined for a plain
 * edge. Folds the `andGroupId ?? orGroupId ?? xorGroupId` lookup that recurred across
 * the router, the canvas edge, and the prune pass into one place. Structural +
 * generic, so it accepts both a domain `Edge` (branded `GroupId`) and the canvas
 * `TPEdgeData` (plain string) while preserving each caller's id type.
 */
export const junctorGroupId = <T extends string>(edge: {
  andGroupId?: T;
  orGroupId?: T;
  xorGroupId?: T;
}): T | undefined => edge.andGroupId ?? edge.orGroupId ?? edge.xorGroupId;

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
export type EdgeIndex = {
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

// Exported so the reach algorithms (`graphReach.findCycles`) can read the
// cached `bySource` index directly without rebuilding it.
export const edgeIndex = (doc: EdgesHost): EdgeIndex => {
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

/**
 * FL-ET7: `Note` entities are free-form annotations. They render on the
 * canvas as their own (yellow-stripe) cards but never participate in
 * edges, never feed CLR rules, and never appear in causality exports —
 * "structural noise" relative to the causality graph.
 */
export const isNote = (entity: Entity): boolean => entity.type === 'note';

/**
 * Entities that exist outside the causal graph. Record-canonical (v10):
 * assumptions are no longer entities (they're edge annotations), so `note`
 * is the only non-causal entity type — but helpers iterating "every
 * causally-meaningful entity" keep filtering via this predicate so a future
 * non-causal type stays one change away.
 */
export const isNonCausal = (entity: Entity): boolean => isNote(entity);

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

const EMPTY_ASSUMPTIONS_BY_EDGE: ReadonlyMap<string, readonly Assumption[]> = new Map();
const EMPTY_ASSUMPTION_RESULT: readonly Assumption[] = Object.freeze([]) as readonly Assumption[];

/**
 * Per-doc memo of first-class assumption records grouped by their host edge
 * (`record.edgeId`). Keyed on the `doc.assumptions` reference — stable until an
 * assumption mutates, same strategy as {@link entitiesByType}. Internal; callers
 * use {@link assumptionsForEdge}.
 */
const assumptionsByEdgeCache = new WeakMap<
  NonNullable<TPDocument['assumptions']>,
  ReadonlyMap<string, readonly Assumption[]>
>();

const assumptionsByEdge = (doc: TPDocument): ReadonlyMap<string, readonly Assumption[]> => {
  const map = doc.assumptions;
  if (!map) return EMPTY_ASSUMPTIONS_BY_EDGE;
  const cached = assumptionsByEdgeCache.get(map);
  if (cached) return cached;
  const byEdge = new Map<string, Assumption[]>();
  for (const a of Object.values(map)) {
    let arr = byEdge.get(a.edgeId);
    if (!arr) {
      arr = [];
      byEdge.set(a.edgeId, arr);
    }
    arr.push(a);
  }
  const frozen: ReadonlyMap<string, readonly Assumption[]> = byEdge;
  assumptionsByEdgeCache.set(map, frozen);
  return frozen;
};

/**
 * The first-class assumption records attached to the given edge (by
 * `record.edgeId`). Cached per `doc.assumptions` reference; returns a stable
 * empty-array reference when the edge has none, so callers' referential-equality
 * checks hold. The record-canonical replacement for walking `edge.assumptionIds`
 * into `doc.entities`.
 */
export const assumptionsForEdge = (doc: TPDocument, edgeId: string): readonly Assumption[] =>
  assumptionsByEdge(doc).get(edgeId) ?? EMPTY_ASSUMPTION_RESULT;

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
 * coordinate. Centralizing the rule means a future schema change only has
 * to update one helper.
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
