import { incomingEdges, outgoingEdges, ST_FACET_KEYS } from '../graph';
import type { Entity, TPDocument } from '../types';
import { makeWarning, type UntieredWarning } from './shared';

/**
 * Session 76 / FL-DT4 S&T discipline rule — position-aware (Session 198, backlog
 * item B; Handbook Ch. 34, Ferguson).
 *
 * A Strategy & Tactics step carries three assumptions, each with a DIRECTION:
 *   - **Necessary assumption** — why this step is *needed*. Justifies the step
 *     UPWARD to its parent, so it only applies to a step that HAS a parent (the
 *     apex, with nothing above it, needs none).
 *   - **Parallel assumption** — why *this* tactic is the right way to reach the
 *     step's strategy. Bridges the step's own strategy ↔ tactic, so it applies
 *     to every step.
 *   - **Sufficiency assumption** — why the step *alone isn't enough* and must
 *     break into sub-steps. Justifies the step DOWNWARD to its children, so it
 *     only applies to a step that HAS children (a leaf needs none).
 *
 * Previously this fired on EVERY tactic missing ANY facet regardless of position
 * — so the apex was wrongly nagged for a necessary assumption it can't have, and
 * every leaf for a sufficiency assumption it can't have. Now it asks only for the
 * assumptions the step's position actually calls for.
 *
 * The facets are the reserved `stNecessaryAssumption` / `stParallelAssumption` /
 * `stSufficiencyAssumption` entity attributes (`ST_FACET_KEYS`), rendered on the
 * tactic card and edited inline. Edge convention: an edge runs child → parent, so
 * a step's OUTGOING edges point at its parent and its INCOMING edges come from its
 * children. Tier `clarity` — "you should declare these," not "structurally broken."
 */
type FacetSpec = {
  key: string;
  /** Plain-language directional name used in the warning. */
  name: string;
  /** Whether this facet applies to a step in the given position. */
  appliesTo: (hasParent: boolean, hasChildren: boolean) => boolean;
};

const FACETS: readonly FacetSpec[] = [
  {
    key: ST_FACET_KEYS.necessaryAssumption,
    name: 'necessary',
    appliesTo: (hasParent) => hasParent,
  },
  {
    key: ST_FACET_KEYS.parallelAssumption,
    name: 'parallel',
    appliesTo: () => true,
  },
  {
    key: ST_FACET_KEYS.sufficiencyAssumption,
    name: 'sufficiency',
    appliesTo: (_hasParent, hasChildren) => hasChildren,
  },
];

/** A facet counts as declared when its attribute exists with a non-empty value. */
const facetFilled = (e: Entity, key: string): boolean => {
  const a = e.attributes?.[key];
  if (!a) return false;
  return a.kind === 'string' ? a.value.trim() !== '' : true;
};

export const stTacticAssumptionsRule = (doc: TPDocument): UntieredWarning[] => {
  if (doc.diagramType !== 'st') return [];
  const out: UntieredWarning[] = [];
  for (const e of Object.values(doc.entities) as Entity[]) {
    if (e.type !== 'injection') continue;
    const hasParent = outgoingEdges(doc, e.id).length > 0;
    const hasChildren = incomingEdges(doc, e.id).length > 0;
    const missing = FACETS.filter(
      (f) => f.appliesTo(hasParent, hasChildren) && !facetFilled(e, f.key)
    ).map((f) => f.name);
    if (missing.length === 0) continue;
    out.push(
      makeWarning(
        doc,
        'st-tactic-assumptions',
        { kind: 'entity', id: e.id },
        `Step is missing its ${missing.join(', ')} assumption${missing.length === 1 ? '' : 's'}. A Strategy & Tactics step declares why it is needed (necessary — points up to its parent), why this tactic fits the strategy (parallel), and, when it has sub-steps, why those are needed (sufficiency — points down to its children).`
      )
    );
  }
  return out;
};
