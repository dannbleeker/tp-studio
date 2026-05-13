import { incomingEdges } from '../graph';
import type { Entity, TPDocument } from '../types';
import { type UntieredWarning, makeWarning } from './shared';

/**
 * Session 76 / FL-DT4 S&T discipline rule.
 *
 * Goldratt's S&T method prescribes that every tactic in the cascade
 * carries three explicit assumption facets:
 *   - **Necessary Assumption** — why the parent strategy actually matters.
 *   - **Parallel Assumption** — why THIS tactic is the right approach (vs.
 *     alternatives that might serve the same strategy).
 *   - **Sufficiency Assumption** — why the tactic actually achieves the
 *     strategy.
 *
 * TP Studio models all three with the existing `necessaryCondition`
 * entity type (the user labels the role via the title or description
 * — "NA: …", "PA: …", "SA: …"). The rule fires when an `injection`
 * entity in an S&T diagram has fewer than three incoming
 * `necessaryCondition` edges. Tier `clarity` because the prescription
 * is "you should declare these," not "the diagram is structurally
 * broken without them."
 *
 * Edge-cases:
 *   - Apex injection with no parent strategy yet → still fires (the
 *     apex is the most important place to declare the three facets).
 *   - An injection that's actually serving as a passthrough rather than
 *     a tactic → user can resolve the warning manually via the
 *     existing Resolve action in WarningsList. No way to detect "this
 *     is a passthrough, not a real tactic" automatically.
 */
export const stTacticAssumptionsRule = (doc: TPDocument): UntieredWarning[] => {
  if (doc.diagramType !== 'st') return [];
  const out: UntieredWarning[] = [];
  for (const e of Object.values(doc.entities) as Entity[]) {
    if (e.type !== 'injection') continue;
    const incoming = incomingEdges(doc, e.id);
    let assumptionFacetCount = 0;
    for (const edge of incoming) {
      const source = doc.entities[edge.sourceId];
      if (source?.type === 'necessaryCondition') assumptionFacetCount++;
    }
    if (assumptionFacetCount >= 3) continue;
    const missing = 3 - assumptionFacetCount;
    out.push(
      makeWarning(
        doc,
        'st-tactic-assumptions',
        { kind: 'entity', id: e.id },
        `Tactic missing ${missing} assumption facet${missing === 1 ? '' : 's'} — Goldratt's S&T prescribes a Necessary, Parallel, and Sufficiency assumption per tactic.`
      )
    );
  }
  return out;
};
