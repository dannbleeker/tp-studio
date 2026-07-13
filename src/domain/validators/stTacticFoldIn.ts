import { incomingEdges } from '../graph';
import type { TPDocument } from '../types';
import { makeWarning, type UntieredWarning } from './shared';

/**
 * Session 198 (backlog item B; Handbook Ch. 34, Ferguson) — Strategy & Tactics
 * "fold-in" check.
 *
 * A Strategy & Tactics step decomposes into the sub-steps that are jointly
 * *sufficient* to achieve it. A decomposition into exactly ONE sub-step is a
 * modelling smell: if a single sub-step is enough on its own, it should fold
 * back INTO the parent (the two are really one step); a real decomposition needs
 * two or more jointly-sufficient children. Soft nudge, not a hard error — some
 * one-child shapes are deliberate mid-build states.
 *
 * Edge convention: an edge runs child → parent, so a step's INCOMING edges come
 * from its children. This fires on an `injection` with exactly one incoming edge.
 * The complementary `st-tactic-rollup` rule covers the zero-children (leaf-with-
 * parent) case, so the two never both fire on the same step. Tier `sufficiency`,
 * matching `st-tactic-rollup`.
 */
export const stTacticFoldInRule = (doc: TPDocument): UntieredWarning[] => {
  const out: UntieredWarning[] = [];
  for (const e of Object.values(doc.entities)) {
    if (e.type !== 'injection') continue;
    // Skip unspecified placeholders — the slot isn't articulated yet (mirrors
    // st-tactic-rollup).
    if (e.unspecified === true) continue;
    // Count only tactic (injection) children as sub-steps. In the facet model
    // every sub-step is an injection, so this is identical there; in the legacy
    // goal=strategy / injection=tactic model it stops a single sub-strategy (goal)
    // or assumption (necessaryCondition) child from reading as a lone sub-step and
    // false-firing on curated first-party patterns.
    const tacticChildren = incomingEdges(doc, e.id).filter(
      (edge) => doc.entities[edge.sourceId]?.type === 'injection'
    );
    if (tacticChildren.length !== 1) continue;
    out.push(
      makeWarning(
        doc,
        'st-tactic-fold-in',
        { kind: 'entity', id: e.id },
        'Step has only one sub-step — a Strategy & Tactics decomposition should split into two or more jointly-sufficient sub-steps, or fold the single sub-step back into this one.'
      )
    );
  }
  return out;
};
