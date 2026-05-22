import { effectiveState } from './statePropagation';
import type { EntityState, TPDocument } from './types';

/**
 * Session 135 — action eligibility (medium gap, unblocked by the
 * Phase 1C state engine).
 *
 * The book's Transition Tree "step" is `(Outcome ← Precondition +
 * Action)`: the Action is the do-something, the Precondition is the
 * existing condition that — together with the Action — produces the
 * Outcome. The `complete-step` CLR rule already checks the *structure*
 * (does an Action have a precondition sibling at all?). This adds the
 * *dynamic* read the spec asks for: given the entity states (manual ??
 * propagation-derived), is the Action's precondition actually
 * **satisfied** — i.e. is the step ready to fire?
 *
 * For a given Action we gather its preconditions — the non-Action,
 * non-Assumption entities feeding the same Outcome(s) the Action feeds
 * (the exact sibling set `complete-step` keys on) — and fold their
 * effective states:
 *
 *   - `'blocked'`   — at least one precondition is `'false'` (the step
 *                     can't fire; `blockedBy` names the first offender).
 *   - `'eligible'`  — there's ≥1 precondition and every one is `'true'`.
 *   - `'pending'`   — preconditions exist but some are `'unknown'` /
 *                     `'disputed'` (not yet decided), none `'false'`.
 *   - `'na'`        — not an Action, or no precondition slot to judge.
 *
 * Pure + overlay-agnostic: pass the `derived` map from `propagateStates`
 * (optionally the speculation overlay's, via `effectiveState`'s third
 * arg if a caller wants what-if eligibility).
 */
export type EligibilityStatus = 'eligible' | 'blocked' | 'pending' | 'na';

export type Precondition = { id: string; title: string; state: EntityState };

export type ActionEligibility = {
  status: EligibilityStatus;
  preconditions: Precondition[];
  /** The first precondition whose effective state is `'false'` — drives
   *  the "blocked because X" message. Only set when `status` is
   *  `'blocked'`. */
  blockedBy?: Precondition;
};

/** Narrow shape — entities + edges are all the computation needs, so
 *  callers can pass the same `{ entities, edges }` slice they hand
 *  `propagateStates`. */
export type EligibilityInput = Pick<TPDocument, 'entities' | 'edges'>;

export function actionEligibility(
  doc: EligibilityInput,
  derived: Record<string, EntityState>,
  actionId: string,
  overrides?: Record<string, EntityState>
): ActionEligibility {
  const action = doc.entities[actionId];
  if (!action || action.type !== 'action') return { status: 'na', preconditions: [] };

  const edges = Object.values(doc.edges);
  // Outcomes this action feeds (skip non-causal back-edges / mutex
  // markers, mirroring the propagation engine).
  const outcomeIds = new Set<string>();
  for (const e of edges) {
    if (e.sourceId !== actionId) continue;
    if (e.isBackEdge || e.isMutualExclusion) continue;
    outcomeIds.add(e.targetId);
  }

  const seen = new Set<string>();
  const preconditions: Precondition[] = [];
  for (const e of edges) {
    if (!outcomeIds.has(e.targetId)) continue;
    if (e.sourceId === actionId) continue;
    if (e.isBackEdge || e.isMutualExclusion) continue;
    const src = doc.entities[e.sourceId];
    if (!src) continue;
    // Preconditions are the non-Action, non-Assumption siblings — the
    // existing conditions, not other do-something steps or edge claims.
    if (src.type === 'action' || src.type === 'assumption') continue;
    if (seen.has(src.id)) continue;
    seen.add(src.id);
    preconditions.push({
      id: src.id,
      title: src.title,
      state: effectiveState(src, derived, overrides),
    });
  }

  if (preconditions.length === 0) return { status: 'na', preconditions };

  const blockedBy = preconditions.find((p) => p.state === 'false');
  if (blockedBy) return { status: 'blocked', preconditions, blockedBy };
  if (preconditions.every((p) => p.state === 'true')) {
    return { status: 'eligible', preconditions };
  }
  return { status: 'pending', preconditions };
}
