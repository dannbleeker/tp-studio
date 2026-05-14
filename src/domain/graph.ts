// Pure graph queries over a TPDocument. No React, no store, no DOM —
// safe to use from validators, store actions, services, and tests.

import type { Edge, Entity, EntityId, TPDocument } from './types';

/**
 * Session 85 (#2) — `requireEntity` / `requireEdge` companions to the
 * existing `getEntity` (line below) and `doc.edges[id]` lookups. Throw
 * on absence with a useful error rather than letting downstream code
 * silently NPE or branch through an `if (!entity) return;` block.
 *
 * Use when the lookup is a runtime invariant: "the action was just
 * dispatched with this id; if it's missing, the store is corrupted."
 * For optional lookups (the entity might legitimately be absent —
 * navigation, search, render skip), prefer the existing `getEntity`
 * helper which returns `Entity | undefined`.
 */
export const requireEntity = (doc: TPDocument, id: string): Entity => {
  const entity = doc.entities[id];
  if (!entity) throw new Error(`requireEntity: no entity with id "${id}" in doc`);
  return entity;
};

export const getEdge = (doc: TPDocument, id: string): Edge | undefined => doc.edges[id];

export const requireEdge = (doc: TPDocument, id: string): Edge => {
  const edge = doc.edges[id];
  if (!edge) throw new Error(`requireEdge: no edge with id "${id}" in doc`);
  return edge;
};

export const incomingEdges = (doc: TPDocument, entityId: string): Edge[] =>
  Object.values(doc.edges).filter((e) => e.targetId === entityId);

export const outgoingEdges = (doc: TPDocument, entityId: string): Edge[] =>
  Object.values(doc.edges).filter((e) => e.sourceId === entityId);

export const connectionCount = (doc: TPDocument, entityId: string): number =>
  incomingEdges(doc, entityId).length + outgoingEdges(doc, entityId).length;

export const hasEdge = (doc: TPDocument, sourceId: string, targetId: string): boolean =>
  Object.values(doc.edges).some((e) => e.sourceId === sourceId && e.targetId === targetId);

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
export const pinnedEntities = (doc: TPDocument): Entity[] =>
  Object.values(doc.entities).filter((e) => e.position !== undefined);

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
export const findCycles = (doc: TPDocument): string[][] => {
  const adj = new Map<string, string[]>();
  for (const id of Object.keys(doc.entities)) adj.set(id, []);
  for (const e of Object.values(doc.edges)) {
    const list = adj.get(e.sourceId);
    if (list) list.push(e.targetId);
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

  return [...cycles.values()];
};

export const removeEntityFromEdges = (doc: TPDocument, entityId: string): Record<string, Edge> => {
  const branded = entityId as EntityId;
  const surviving = Object.values(doc.edges).filter(
    (e) => e.sourceId !== branded && e.targetId !== branded
  );
  const result: Record<string, Edge> = {};
  for (const edge of surviving) {
    if (!edge.assumptionIds?.includes(branded)) {
      result[edge.id] = edge;
      continue;
    }
    const filtered = edge.assumptionIds.filter((a) => a !== branded);
    result[edge.id] = { ...edge, assumptionIds: filtered.length ? filtered : undefined };
  }
  return result;
};
