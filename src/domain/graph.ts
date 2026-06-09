// Pure graph queries over a TPDocument. No React, no store, no DOM —
// safe to use from validators, store actions, services, and tests.
//
// Session 165 — split into focused modules; this file stays the single public
// entry point (`@/domain/graph`) by re-exporting them, so the 40+ importers are
// unchanged:
//   - `graphCore.ts` — the cached array / edge-index / by-type lookups + the
//     entity predicates (a dependency-free leaf).
//   - `graphReach.ts` — reachability / path / cycle traversals.
//   - `graphPrune.ts` — cascade-delete cleanup + the comment-count aggregation.

export {
  assumptionsForEdge,
  connectionCount,
  edgesArray,
  entitiesArray,
  entitiesByType,
  entitiesOfType,
  getEntity,
  hasEdge,
  incomingEdges,
  isNonCausal,
  isNote,
  isStNodeFormat,
  junctorGroupId,
  outgoingEdges,
  pinnedEntities,
  ST_FACET_KEYS,
  structuralEntities,
} from './graphCore';
export {
  openCommentCountsByAnchor,
  pruneAssumptions,
  pruneComments,
  pruneDanglingEdges,
  pruneSingletonJunctors,
  reanchorEdgeComments,
  rehomeAssumptions,
  removeEntityFromEdges,
} from './graphPrune';
export { findCycles, findPath, reachableBackward, reachableForward } from './graphReach';
