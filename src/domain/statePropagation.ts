/**
 * Session 135 / spec major gap #4 Phase 1B — entity-state propagation
 * engine.
 *
 * Pure function. Given a document, walk every entity and compute a
 * derived state from the incoming edges. Returns the derived map; the
 * caller decides whether to display it as-is, merge with the manual
 * `entity.state` override, or flag a conflict between the two.
 *
 * No mutation: the doc passed in is not modified. The result is a
 * plain record keyed by entity id, with every entity in the doc
 * present (entities with no incoming edges resolve to `'unknown'` —
 * propagation has nothing to say about them, the user's manual state
 * is the ground truth).
 *
 * Edge contribution model (per incoming edge):
 *   - Source state read from `entity.state` (manual override) if set,
 *     else from the derived map (recursive).
 *   - `weight: 'negative'` inverts true ↔ false; `'disputed'` /
 *     `'unknown'` pass through unchanged. Models counter-causal
 *     edges ("more X causes LESS Y").
 *   - `weight: 'zero'` contributes nothing — the edge declared itself
 *     a no-signal link.
 *   - `isBackEdge: true` skipped — the user flagged the edge as an
 *     intentional reinforcing loop; running propagation through it
 *     would loop forever and isn't what the user wanted to model.
 *   - `isMutualExclusion: true` skipped — EC-only marker, not a
 *     causal contribution.
 *
 * Junctor merge (across a single target's incoming edges):
 *   - `andGroupId` shared → AND-reduce:
 *       all-true → true; any-false → false;
 *       any-disputed (no-false) → disputed; else unknown.
 *   - `xorGroupId` shared → XOR-reduce:
 *       exactly-one-true → true; multiple-true → false;
 *       any-disputed → disputed; all-false → false; else unknown.
 *   - `orGroupId` shared OR no junctor at all (implicit OR) →
 *     OR-reduce:
 *       any-true → true; any-disputed (no-true) → disputed;
 *       all-false → false; else unknown.
 *
 * Each junctor group contributes a single OR-input at the top level —
 * mixing an AND-group with two standalone edges, for example, gives
 * three OR-inputs (one from the AND-group's AND-reduce, two from the
 * standalone edges).
 *
 * Cycle handling: entities currently in the recursion stack contribute
 * `'unknown'` so propagation terminates instead of looping. Honest
 * acyclic graphs aren't affected.
 *
 * **Manual override is NOT applied to the returned values.** The
 * caller has `entity.state` already, and is the only one who knows
 * whether to display the authored value, the propagated value, or
 * both side-by-side. `effectiveState()` is the canonical merge helper.
 */

import type { Edge, EdgeWeight, Entity, EntityId, EntityState, TPDocument } from './types';

/**
 * Merge an entity's state with its propagated state. Precedence:
 *   1. speculative `overrides[id]` (Phase 1C what-if overlay), if set
 *   2. the authored manual `entity.state`, if set
 *   3. the propagated `derived[id]`
 *   4. `'unknown'`
 *
 * Returns `'unknown'` if the id isn't in the doc. The `overrides`
 * argument is optional — non-speculation callers omit it and get the
 * Phase 1B manual-wins behaviour unchanged.
 */
export function effectiveState(
  entity: Entity | undefined,
  derived: Record<string, EntityState>,
  overrides?: Record<string, EntityState>
): EntityState {
  if (!entity) return 'unknown';
  const ov = overrides?.[entity.id];
  if (ov) return ov;
  if (entity.state) return entity.state;
  return derived[entity.id] ?? 'unknown';
}

const AND_TIER = 'and' as const;
const OR_TIER = 'or' as const;
const XOR_TIER = 'xor' as const;
type JunctorTier = typeof AND_TIER | typeof OR_TIER | typeof XOR_TIER;

/** Reduce a list of state values via AND semantics. See module-level
 *  comment for the full table. */
function reduceAnd(values: EntityState[]): EntityState {
  if (values.length === 0) return 'unknown';
  if (values.includes('false')) return 'false';
  if (values.includes('disputed')) return 'disputed';
  if (values.every((v) => v === 'true')) return 'true';
  return 'unknown';
}

/** Reduce a list of state values via OR semantics. */
function reduceOr(values: EntityState[]): EntityState {
  if (values.length === 0) return 'unknown';
  if (values.includes('true')) return 'true';
  if (values.includes('disputed')) return 'disputed';
  if (values.every((v) => v === 'false')) return 'false';
  return 'unknown';
}

/** Reduce a list of state values via XOR semantics — exactly-one-true
 *  asserts true, anything else fails the junctor. */
function reduceXor(values: EntityState[]): EntityState {
  if (values.length === 0) return 'unknown';
  if (values.includes('disputed')) return 'disputed';
  const trues = values.filter((v) => v === 'true').length;
  if (trues === 1 && values.every((v) => v === 'true' || v === 'false')) return 'true';
  if (trues >= 2) return 'false';
  if (values.every((v) => v === 'false')) return 'false';
  return 'unknown';
}

/** Apply edge weight to a source state. `'negative'` flips true ↔
 *  false; `'zero'` returns `null` to signal "skip this contribution";
 *  anything else passes the state through unchanged. */
function applyWeight(source: EntityState, weight: EdgeWeight | undefined): EntityState | null {
  if (weight === 'zero') return null;
  if (weight !== 'negative') return source;
  if (source === 'true') return 'false';
  if (source === 'false') return 'true';
  return source;
}

/**
 * The shape `propagateStates` actually needs — just the entities + edges
 * maps. Accepting the narrow shape lets callers subscribe to only those
 * two store fields (instead of the full doc) before invoking the engine.
 */
export type PropagationInput = Pick<TPDocument, 'entities' | 'edges'>;

/**
 * Compute the derived (propagated) state for every entity.
 *
 * `overrides` (Phase 1C what-if overlay) is an optional map of
 * speculative states. When present, an overridden entity contributes
 * its speculative value downstream INSTEAD of its manual state or its
 * own propagated value — so the caller can ask "what cascades if this
 * assumption were false?" without touching the persisted doc. Omit it
 * for the plain Phase 1B pass. The returned map is still the pure
 * propagated value per node (the override is applied to downstream
 * *contributions*, not written back into the result) — pair it with
 * `effectiveState(entity, derived, overrides)` for display.
 */
export function propagateStates(
  doc: PropagationInput,
  overrides?: Record<string, EntityState>
): Record<EntityId, EntityState> {
  const entities = doc.entities;
  const edges = Object.values(doc.edges);

  // Build incoming-edge index up front so per-entity lookup is O(1).
  const incoming = new Map<string, Edge[]>();
  for (const e of edges) {
    // Skip non-causal edges: back-edges (intentional loops) and
    // mutual-exclusion markers carry no propagation signal.
    if (e.isBackEdge || e.isMutualExclusion) continue;
    const list = incoming.get(e.targetId) ?? [];
    list.push(e);
    incoming.set(e.targetId, list);
  }

  const derived: Record<EntityId, EntityState> = {};
  const inProgress = new Set<string>();

  function effective(id: string): EntityState {
    // Phase 1C — a speculative override outranks everything: it's the
    // hypothetical the user is exploring, so it flows downstream in
    // place of the entity's manual or propagated value.
    const ov = overrides?.[id];
    if (ov) return ov;
    const ent = entities[id];
    if (!ent) return 'unknown';
    // Manual override wins when reading the source's contribution to
    // a downstream entity — propagation respects authored claims.
    if (ent.state) return ent.state;
    if (id in derived) return derived[id as EntityId] ?? 'unknown';
    if (inProgress.has(id)) return 'unknown'; // cycle short-circuit
    return computeDerived(id);
  }

  function computeDerived(id: string): EntityState {
    if (id in derived) return derived[id as EntityId] ?? 'unknown';
    inProgress.add(id);
    const inputs = incoming.get(id) ?? [];
    if (inputs.length === 0) {
      derived[id as EntityId] = 'unknown';
      inProgress.delete(id);
      return 'unknown';
    }

    // Group by junctor: AND / OR / XOR groups become one OR-input
    // each. Edges with no junctor are individual OR-inputs.
    const groups = new Map<string, { tier: JunctorTier; edges: Edge[] }>();
    const standalone: Edge[] = [];
    for (const ed of inputs) {
      if (ed.andGroupId) {
        const key = `and:${ed.andGroupId}`;
        const g = groups.get(key) ?? { tier: AND_TIER, edges: [] };
        g.edges.push(ed);
        groups.set(key, g);
      } else if (ed.xorGroupId) {
        const key = `xor:${ed.xorGroupId}`;
        const g = groups.get(key) ?? { tier: XOR_TIER, edges: [] };
        g.edges.push(ed);
        groups.set(key, g);
      } else if (ed.orGroupId) {
        const key = `or:${ed.orGroupId}`;
        const g = groups.get(key) ?? { tier: OR_TIER, edges: [] };
        g.edges.push(ed);
        groups.set(key, g);
      } else {
        standalone.push(ed);
      }
    }

    const orInputs: EntityState[] = [];
    for (const { tier, edges: groupEdges } of groups.values()) {
      const contribs: EntityState[] = [];
      for (const ed of groupEdges) {
        const src = effective(ed.sourceId);
        const c = applyWeight(src, ed.weight);
        if (c !== null) contribs.push(c);
      }
      if (contribs.length === 0) continue;
      const reduced =
        tier === AND_TIER
          ? reduceAnd(contribs)
          : tier === XOR_TIER
            ? reduceXor(contribs)
            : reduceOr(contribs);
      orInputs.push(reduced);
    }
    for (const ed of standalone) {
      const src = effective(ed.sourceId);
      const c = applyWeight(src, ed.weight);
      if (c !== null) orInputs.push(c);
    }

    const result = orInputs.length === 0 ? 'unknown' : reduceOr(orInputs);
    derived[id as EntityId] = result;
    inProgress.delete(id);
    return result;
  }

  for (const id of Object.keys(entities)) {
    computeDerived(id);
  }

  return derived;
}
