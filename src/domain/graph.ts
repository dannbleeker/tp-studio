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
  connectionCount,
  edgesArray,
  entitiesArray,
  entitiesByType,
  entitiesOfType,
  getEntity,
  hasEdge,
  incomingEdges,
  isAssumption,
  isNonCausal,
  isNote,
  isStNodeFormat,
  outgoingEdges,
  pinnedEntities,
  ST_FACET_KEYS,
  structuralEntities,
} from './graphCore';
export {
  openCommentCountsByAnchor,
  pruneAssumptions,
  pruneComments,
  removeEntityFromEdges,
} from './graphPrune';
export { findCycles, findPath, reachableBackward, reachableForward } from './graphReach';
