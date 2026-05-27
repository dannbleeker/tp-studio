/**
 * Phase A — bridge from the `useGraphView` pipeline to the
 * `routeEdge` domain function. See `docs/EDGE_ROUTING_PROPOSAL.md`.
 *
 * Pipeline position:
 *
 *   useGraphProjection  →  useGraphPositions  →  useEdgeRoutes (this)
 *                                                ↓
 *                                            useGraphEmission stamps
 *                                            `data.route` per edge
 *
 * Phase A behavior: returns an empty map. The `SMART_ROUTING_ENABLED`
 * constant is hard-coded to `false` per the locked decision in the
 * proposal (hold Phases A + B for Phase C as the first user-visible
 * release). Phase B will populate the map when the gate is `true`;
 * Phase C flips the gate to a real `useDocumentStore((s) =>
 * s.edgeRouting === 'smart')` read.
 *
 * This file lands on main as dead-but-tested code until Phase C. The
 * test pins the contract (returns {} regardless of input) so a future
 * refactor doesn't accidentally activate it without flipping the gate
 * properly.
 */

import { useMemo } from 'react';
import type { EdgeRoute } from '@/domain/edgeRouting';
import type { TPDocument } from '@/domain/types';
import type { GraphPositions } from './useGraphPositions';
import type { GraphProjection } from './useGraphProjection';

/**
 * Phase-gate constant. Read by `useEdgeRoutes` to decide whether to
 * call `routeEdge` per edge or short-circuit with `{}`. Phase C flips
 * this to a store-backed preference read; until then it's a hard
 * `false` so Phases A + B can land as dead-but-tested code without
 * shifting any user-visible behavior.
 *
 * Exported for the test so we can assert the gate's current value and
 * fail loudly if a future commit flips it without the corresponding
 * Settings + StoredPrefs wiring.
 */
export const SMART_ROUTING_ENABLED = false;

/** Map from edge id → routed geometry. Empty when the gate is off. */
export type EdgeRouteMap = Readonly<Record<string, EdgeRoute>>;

/**
 * Compute the per-edge route map. Phase A returns `{}` unconditionally
 * because `SMART_ROUTING_ENABLED` is hard-coded `false`; the memo
 * dependency list still includes (doc, projection, positions) so the
 * gate-flip in Phase C lands without touching this signature.
 */
export const useEdgeRoutes = (
  doc: TPDocument,
  projection: GraphProjection,
  positions: GraphPositions
): EdgeRouteMap => {
  // biome-ignore lint/correctness/useExhaustiveDependencies: by design — the dep list is the API surface the Phase B/C body will consume (iterate edges via projection + doc, look up obstacle boxes from positions). Phase A short-circuits before reading any of them; keeping the deps listed means the gate-flip in Phase C only has to change the gate constant + memo body, not the dep array.
  return useMemo<EdgeRouteMap>(() => {
    if (!SMART_ROUTING_ENABLED) return {};
    // Phase B+ populate path here. The shape is locked: iterate the
    // visible edges (`projection.remap` + `doc.edges`), collect non-
    // endpoint obstacle boxes from `positions`, call `routeEdge` per
    // edge, stamp the result keyed by edge id. Phase A stops short.
    return {};
  }, [doc, projection, positions]);
};
