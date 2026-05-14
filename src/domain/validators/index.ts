import type { ClrTier, DiagramType, TPDocument, Warning } from '../types';
import { additionalCauseRuleFor } from './additionalCause';
import { causalityExistenceRule } from './causalityExistence';
import { causeEffectReversalRule } from './causeEffectReversal';
import { causeSufficiencyRule } from './causeSufficiency';
import { clarityRule } from './clarity';
import { completeStepRule } from './completeStep';
import { cycleRule } from './cycle';
import { ecCompletenessRule } from './ecCompleteness';
import { ecMissingConflictRule } from './ecMissingConflict';
import { entityExistenceRule } from './entityExistence';
import { externalRootCauseRule } from './externalRootCause';
import { indirectEffectRule } from './indirectEffect';
import { predictedEffectExistenceRule } from './predictedEffectExistence';
import { type TieredRule, tieredRule } from './shared';
import { stTacticAssumptionsRule } from './stTacticAssumptions';
import { tautologyRule } from './tautology';

/**
 * Per-diagram CLR rule sets. Each rule is a `ValidatorRule` imported from
 * its own file under this directory; this index assembles them into the
 * registry consumed by `validate` below.
 *
 * Rules are wrapped with `tieredRule(tier, ruleId, fn)` at composition
 * time — the per-rule files stay clean plain-function exports, and the
 * tier mapping lives in one place. Block C / E5 reads the tier to group
 * warnings under CLARITY / EXISTENCE / SUFFICIENCY headers in the
 * Inspector's WarningsList.
 */

/**
 * CLR rules that apply to any diagram with a graph (entities + edges). These
 * make no assumption about which entity types exist; they read titles, edge
 * endpoints, and structural connectivity only.
 */
const STRUCTURAL_RULES: TieredRule[] = [
  tieredRule('clarity', 'clarity', clarityRule),
  tieredRule('existence', 'entity-existence', entityExistenceRule),
  tieredRule('existence', 'causality-existence', causalityExistenceRule),
  tieredRule('clarity', 'tautology', tautologyRule),
  // Block C additions (E3 + E2):
  tieredRule('existence', 'cycle', cycleRule),
  tieredRule('existence', 'indirect-effect', indirectEffectRule),
];

/**
 * Per-diagram rule set. Diagrams that aren't a strict superset of the
 * structural rules (e.g. Evaporating Cloud, which is hand-positioned and
 * isn't a causality graph) can opt out by listing their own array.
 *
 * Adding a new diagram type: TypeScript will force this map to be exhaustive,
 * which is the point — a forgotten entry shows up as a compile error rather
 * than a silently empty rule set.
 */
const RULES_BY_DIAGRAM: Record<DiagramType, TieredRule[]> = {
  crt: [
    ...STRUCTURAL_RULES,
    tieredRule('sufficiency', 'cause-sufficiency', causeSufficiencyRule),
    tieredRule('sufficiency', 'additional-cause', additionalCauseRuleFor('ude')),
    tieredRule('existence', 'cause-effect-reversal', causeEffectReversalRule),
    // Mental-model nudge: a `rootCause` flagged spanOfControl='external'
    // probably isn't the real root. CRT-specific because FRT injections
    // are external by design and the warning would be noise there.
    tieredRule('clarity', 'external-root-cause', externalRootCauseRule),
  ],
  frt: [
    ...STRUCTURAL_RULES,
    tieredRule('sufficiency', 'cause-sufficiency', causeSufficiencyRule),
    tieredRule('sufficiency', 'additional-cause', additionalCauseRuleFor('desiredEffect')),
    tieredRule('existence', 'predicted-effect-existence', predictedEffectExistenceRule),
  ],
  // PRT (A2): the structural rules apply; the PRT-specific rules
  // ("a goal with no IOs feeding obstacles below") are parked.
  prt: STRUCTURAL_RULES,
  // TT (A3): structural rules plus the TT Complete-Step check — every
  // Action should be paired with a Precondition in the AND-junction
  // feeding its Outcome. Tier 'sufficiency' because the question is
  // "are these causes enough on their own?" rather than "do these
  // entities exist?"
  tt: [...STRUCTURAL_RULES, tieredRule('sufficiency', 'complete-step', completeStepRule)],
  // EC (A1): structural rules plus the missing-conflict check. The book
  // makes the conflict between the two Wants explicit via an edge; without
  // such an edge, an EC is structurally incomplete. The "both wants point
  // at the objective via their needs" rule remains parked — verifiable but
  // less informative than the missing-conflict check.
  ec: [
    ...STRUCTURAL_RULES,
    tieredRule('existence', 'ec-missing-conflict', ecMissingConflictRule),
    // Session 77 / brief §6 — 5-rule structural + completeness check.
    // Tier `existence` because most sub-warnings are about the
    // diagnostic being structurally well-formed; the soft "missing
    // assumption / injection" ones live in the same rule so users see
    // them next to the structural ones in the EC inspector.
    tieredRule('existence', 'ec-completeness', ecCompletenessRule),
  ],
  // FL-DT4 — Strategy & Tactics Tree. Structural rules plus the
  // discipline rule: every tactic should declare three assumption
  // facets (NA, PA, SA). Tier `clarity` — the prescription is a nudge,
  // not a structural defect, and the user can resolve specific
  // warnings via WarningsList if a particular tactic genuinely doesn't
  // need all three.
  st: [
    ...STRUCTURAL_RULES,
    tieredRule('clarity', 'st-tactic-assumptions', stTacticAssumptionsRule),
  ],
  // FL-DT5 — Freeform diagrams skip every type-pattern-matching CLR rule
  // by definition (no built-in TOC types in the canonical palette). Only
  // the structural rules — entity-existence, causality-existence,
  // clarity, tautology, cycle, indirect-effect — apply.
  freeform: STRUCTURAL_RULES,
  // Session 77 / brief §5 — Goal Tree. Structural rules apply (titles
  // need content; necessity edges still need endpoints; tautology still
  // matters). The single-goal constraint + 3-5-CSF nudge are enforced
  // separately in the Goal Tree creation flow + store actions, not as
  // CLR rules — they're hard constraints rather than per-entity soft
  // warnings.
  goalTree: STRUCTURAL_RULES,
};

/**
 * Run every rule for the doc's diagram type. Each rule file returns
 * `Warning[]` without a `tier` field (rule files don't know their own tier
 * — that's a composition concern); this layer stamps the rule's
 * registered tier onto every warning before returning. WarningsList
 * (Block C / E5) reads `w.tier` to group rendered warnings.
 */
export const validate = (doc: TPDocument): Warning[] =>
  RULES_BY_DIAGRAM[doc.diagramType].flatMap((r) => r.fn(doc).map((w) => ({ ...w, tier: r.tier })));

/**
 * `validate()` grouped by tier. Tiers with no warnings keep an empty
 * array entry so consumers iterating `Object.entries` see a stable
 * shape regardless of which tiers produced output. Today the WarningsList
 * groups its already-filtered slice by reading `w.tier` directly, so
 * this helper is here mostly for tests + future "all warnings, by tier"
 * use cases (a future Run-validation summary view, for instance).
 */
export const validateTiered = (doc: TPDocument): Record<ClrTier, Warning[]> => {
  const out: Record<ClrTier, Warning[]> = {
    clarity: [],
    existence: [],
    sufficiency: [],
  };
  for (const w of validate(doc)) out[w.tier].push(w);
  return out;
};

// Re-export per-rule entry points that real consumers (tests, callers)
// import via `@/domain/validators`. Speculative re-exports for rules
// that no consumer references were dropped — tests can still target a
// single rule via direct `./clarity` imports if needed later, with no
// boilerplate cost.
export { cycleRule } from './cycle';
export { completeStepRule } from './completeStep';
export { ecMissingConflictRule } from './ecMissingConflict';
export { externalRootCauseRule } from './externalRootCause';
export type { UntieredWarning, ValidatorRule } from './shared';
