import { ST_FACET_KEYS } from '../graph';
import type { Entity, TPDocument } from '../types';
import { makeWarning, type UntieredWarning } from './shared';

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
 * These are first-class, canonical fields: the reserved `stNecessaryAssumption`
 * / `stParallelAssumption` / `stSufficiencyAssumption` entity attributes
 * (`ST_FACET_KEYS`), rendered as the tactic's 5-facet card and edited inline.
 * The rule counts those FILLED facets and names which of NA / PA / SA is still
 * missing. (It previously counted incoming `necessaryCondition` *entities* — a
 * representation nothing else in the app uses — so a tactic with all three
 * facets filled on its card was still flagged "missing 3," while three unrelated
 * NC children passed with empty facets.) Tier `clarity` because the prescription
 * is "you should declare these," not "the diagram is structurally broken."
 *
 * Edge-cases:
 *   - Apex injection with no parent strategy yet → still fires (the
 *     apex is the most important place to declare the three facets).
 *   - An injection that's actually serving as a passthrough rather than
 *     a tactic → user can resolve the warning manually via the
 *     existing Resolve action in WarningsList.
 */
const FACETS = [
  { key: ST_FACET_KEYS.necessaryAssumption, label: 'Necessary' },
  { key: ST_FACET_KEYS.parallelAssumption, label: 'Parallel' },
  { key: ST_FACET_KEYS.sufficiencyAssumption, label: 'Sufficiency' },
] as const;

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
    const missing = FACETS.filter((f) => !facetFilled(e, f.key)).map((f) => f.label);
    if (missing.length === 0) continue;
    out.push(
      makeWarning(
        doc,
        'st-tactic-assumptions',
        { kind: 'entity', id: e.id },
        `Tactic missing ${missing.length} assumption facet${missing.length === 1 ? '' : 's'} (${missing.join(', ')}) — Goldratt's S&T prescribes a Necessary, Parallel, and Sufficiency assumption per tactic.`
      )
    );
  }
  return out;
};
