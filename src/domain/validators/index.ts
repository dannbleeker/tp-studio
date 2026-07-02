import { validationFingerprint } from '../fingerprint';
import type { ClrTier, DiagramType, TPDocument, Warning } from '../types';
import { additionalCauseRuleFor } from './additionalCause';
import { causalityExistenceRule } from './causalityExistence';
import { causeEffectReversalRule } from './causeEffectReversal';
import { causeSufficiencyRule } from './causeSufficiency';
import { clarityRule } from './clarity';
import { completeStepRule } from './completeStep';
import { crtLowCoreDriverCoverageRule, crtTiedCoreDriversRule } from './crtCoreDriverChecks';
import { crtDeadBranchRule } from './crtDeadBranch';
import { crtUdeCountRule } from './crtUdeCount';
import { crtUdeNoUpstreamRule } from './crtUdeNoUpstream';
import { crtUdeWordingRule } from './crtUdeWording';
import { ecCompletenessRule } from './ecCompleteness';
import { ecMissingConflictRule } from './ecMissingConflict';
import { entityExistenceRule } from './entityExistence';
import { externalRootCauseRule } from './externalRootCause';
import { goalTreeMultipleGoalsRule } from './goalTreeMultipleGoals';
import { goalTreeCsfCountRule, goalTreeCsfNoNcsRule } from './goalTreeStructural';
import { indirectEffectRule } from './indirectEffect';
import { logicTypeMismatchRule } from './logicTypeMismatch';
import { longArrowRule } from './longArrow';
import { loopPolarityRule } from './loopPolarity';
import { nbrNoNegativeBranchRule, nbrUdeDisconnectedRule } from './nbrBranchIntegrity';
import { predictedEffectExistenceRule } from './predictedEffectExistence';
import { prtIoNoObstacleRule, prtObstacleNoIoRule } from './prtStructural';
import { reinforcingNoDelayRule } from './reinforcingNoDelay';
import { type TieredRule, tieredRule } from './shared';
import { stTacticAssumptionsRule } from './stTacticAssumptions';
import { stTacticRollupRule } from './stTacticRollup';
import { tautologyRule } from './tautology';
import { ttActionLocusUnsetRule } from './ttActionLocusUnset';

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
  // Block C addition (E2). (The E3 cycle rule was removed Session 176 — the
  // auto-detected back-edge colour now signals a loop, so the warning was redundant.)
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
    // Session 179 — external-source review batch (Theme B + C2 + A2).
    tieredRule('clarity', 'crt-ude-count', crtUdeCountRule),
    tieredRule('existence', 'crt-ude-no-upstream', crtUdeNoUpstreamRule),
    tieredRule('clarity', 'crt-dead-branch', crtDeadBranchRule),
    tieredRule('clarity', 'crt-low-core-driver-coverage', crtLowCoreDriverCoverageRule),
    tieredRule('clarity', 'crt-tied-core-drivers', crtTiedCoreDriversRule),
    tieredRule('clarity', 'crt-ude-wording', crtUdeWordingRule),
    tieredRule('clarity', 'logic-type-mismatch', logicTypeMismatchRule),
    tieredRule('clarity', 'loop-polarity', loopPolarityRule),
    // Session 180 (E5) — long-arrow / missing-step (depth-twin of indirect-effect).
    tieredRule('existence', 'long-arrow', longArrowRule),
    // Session 180 (Theme A / A4) — reinforcing loop with no delay.
    tieredRule('clarity', 'reinforcing-no-delay', reinforcingNoDelayRule),
  ],
  frt: [
    ...STRUCTURAL_RULES,
    tieredRule('sufficiency', 'cause-sufficiency', causeSufficiencyRule),
    tieredRule('sufficiency', 'additional-cause', additionalCauseRuleFor('desiredEffect')),
    tieredRule('existence', 'predicted-effect-existence', predictedEffectExistenceRule),
    // Session 179 — logic-type lint + loop-polarity (Theme C2 + A2).
    tieredRule('clarity', 'logic-type-mismatch', logicTypeMismatchRule),
    tieredRule('clarity', 'loop-polarity', loopPolarityRule),
    // Session 180 (E5) — long-arrow / missing-step.
    tieredRule('existence', 'long-arrow', longArrowRule),
    // Session 180 (Theme A / A4) — reinforcing loop with no delay.
    tieredRule('clarity', 'reinforcing-no-delay', reinforcingNoDelayRule),
  ],
  // PRT (A2): structural rules plus the obstacle↔IO pairing checks (Session 192
  // improvement review — the PRT-specific rules were previously parked). Tier
  // `existence` — an unpaired obstacle or IO is a structural gap in the plan.
  prt: [
    ...STRUCTURAL_RULES,
    tieredRule('existence', 'prt-obstacle-no-io', prtObstacleNoIoRule),
    tieredRule('existence', 'prt-io-no-obstacle', prtIoNoObstacleRule),
  ],
  // TT (A3): structural rules plus the TT Complete-Step check — every
  // Action should be paired with a Precondition in the AND-junction
  // feeding its Outcome. Tier 'sufficiency' because the question is
  // "are these causes enough on their own?" rather than "do these
  // entities exist?"
  tt: [
    ...STRUCTURAL_RULES,
    tieredRule('sufficiency', 'complete-step', completeStepRule),
    // Session 135 — TT action-locus discipline. Fires on `action`
    // entities without `spanOfControl` set. Tier `clarity` — same
    // taxonomic slot as the existing `external-root-cause` mental-
    // model nudge.
    tieredRule('clarity', 'tt-action-locus-unset', ttActionLocusUnsetRule),
    // Session 179 — logic-type lint (Theme C2).
    tieredRule('clarity', 'logic-type-mismatch', logicTypeMismatchRule),
    // Session 180 (E5) — long-arrow / missing-step.
    tieredRule('existence', 'long-arrow', longArrowRule),
  ],
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
    // Improvement review — EC support edges are uniformly necessity-typed, so
    // the logic-type lint applies (the D↔D′ mutex edge is skipped in the rule).
    tieredRule('clarity', 'logic-type-mismatch', logicTypeMismatchRule),
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
    // Session 135 — S&T tactic-rollup structural check. Fires on
    // non-apex `injection` (tactic) entities that lack child
    // tactics. Tier `sufficiency` (parallel to `cause-sufficiency`
    // and `complete-step`).
    tieredRule('sufficiency', 'st-tactic-rollup', stTacticRollupRule),
  ],
  // FL-DT5 — Freeform diagrams skip every type-pattern-matching CLR rule
  // by definition (no built-in TOC types in the canonical palette). Only
  // the structural rules — entity-existence, causality-existence,
  // clarity, tautology, cycle, indirect-effect — apply.
  freeform: STRUCTURAL_RULES,
  // Session 77 / brief §5 — Goal Tree. Structural rules plus the
  // Session 79 single-apex nudge. Tier `clarity` on the multi-goal
  // rule — the diagram still works with multiple goals, the user
  // is just out of Dettmer's pattern. The rule carries a one-click
  // "Convert extras to CSFs" action via the WARNING_ACTIONS registry.
  goalTree: [
    ...STRUCTURAL_RULES,
    tieredRule('clarity', 'goalTree-multiple-goals', goalTreeMultipleGoalsRule),
    // Session 179 — logic-type lint, necessity logic (Theme C2).
    tieredRule('clarity', 'logic-type-mismatch', logicTypeMismatchRule),
    // Session 192 (improvement review) — Goal→CSF→NC structural checks. A CSF
    // with no Necessary Conditions is a rollup-sufficiency gap; the CSF count is
    // a Dettmer-pattern scope nudge (analogue of crt-ude-count).
    tieredRule('sufficiency', 'goalTree-csf-no-ncs', goalTreeCsfNoNcsRule),
    tieredRule('clarity', 'goalTree-csf-count', goalTreeCsfCountRule),
  ],
  // Session 134 / spec major gap #5 — NBR runs the FRT rule set: structural
  // rules + cause-sufficiency + additional-cause (target widened to BOTH `ude`
  // and `desiredEffect`, since an NBR carries both — the widening was claimed
  // here since S134 but only built in S181) + predicted-effect-existence. The
  // negative-branch shape is essentially "an FRT subtree that ends in UDEs
  // instead of desired effects," so the rules transfer cleanly. On top, two
  // NBR-specific shape rules (Session 181) verify the canonical walk the
  // method checklist teaches and the risk-register export assumes:
  // injection → forward chain → UDEs.
  nbr: [
    ...STRUCTURAL_RULES,
    tieredRule('sufficiency', 'cause-sufficiency', causeSufficiencyRule),
    tieredRule('sufficiency', 'additional-cause', additionalCauseRuleFor('ude', 'desiredEffect')),
    tieredRule('existence', 'predicted-effect-existence', predictedEffectExistenceRule),
    tieredRule('existence', 'nbr-no-negative-branch', nbrNoNegativeBranchRule),
    tieredRule('existence', 'nbr-ude-disconnected', nbrUdeDisconnectedRule),
    // Session 179 — logic-type lint + loop-polarity (Theme C2 + A2).
    tieredRule('clarity', 'logic-type-mismatch', logicTypeMismatchRule),
    tieredRule('clarity', 'loop-polarity', loopPolarityRule),
    // Session 180 (E5) — long-arrow / missing-step.
    tieredRule('existence', 'long-arrow', longArrowRule),
    // Session 180 (Theme A / A4) — reinforcing loop with no delay.
    tieredRule('clarity', 'reinforcing-no-delay', reinforcingNoDelayRule),
  ],
};

/**
 * Run every rule for the doc's diagram type. Each rule file returns
 * `Warning[]` without a `tier` field (rule files don't know their own tier
 * — that's a composition concern); this layer stamps the rule's
 * registered tier onto every warning before returning. WarningsList
 * (Block C / E5) reads `w.tier` to group rendered warnings.
 */
// Session 85 (#8) — per-doc-reference memo. `validate(doc)` runs every
// registered CLR rule's `fn(doc)` flatmap; with 20+ rules registered
// per diagram type, that's a real cost on each call. WeakMap keyed by
// doc reference means a cache hit ≡ "doc unchanged since last validate
// call" — same semantics as the existing call-site `useFingerprintMemo`
// gates, but transparent to every caller. The remaining
// `useFingerprintMemo` wrappers stay (they save the React render-cycle
// cost of producing a fresh array reference); this layer saves the
// downstream re-computation.
const validateCache = new WeakMap<TPDocument, Warning[]>();

/**
 * Session 135 / Perf #5 — fingerprint-keyed cache.
 *
 * The doc-reference cache above hits only when the exact same
 * TPDocument reference is passed in. Any mutation creates a new
 * reference and forces every rule to re-run — even mutations that
 * don't affect any rule's inputs (positions, attestation, owner,
 * evidence, attributes other than the S&T facets, descriptions,
 * dialogs / preferences). Those mutations happen often: drag-to-pin
 * fires once per frame, every keystroke in a description bumps the
 * doc reference, etc.
 *
 * The fingerprint includes diagram type + entity ids/types/titles +
 * edge endpoints + and-group ids + resolved-warning ids. When a
 * mutation doesn't change the fingerprint, we re-use the prior
 * validation result and short-circuit the rule run.
 *
 * The fingerprint cache is a bounded LRU on (fingerprint string →
 * Warning[]). 32 entries is enough to cover the realistic
 * doc-history depth within a single editing session without
 * unbounded growth. When a cached fingerprint hits, we also write
 * back into the doc-reference WeakMap so subsequent calls with the
 * same doc reference take the faster path.
 *
 * Estimated impact: drag-to-pin + position-edit-heavy sessions
 * (which dominated the perf-trace baselines) now skip the validator
 * sweep entirely — every drag frame and every non-causal text edit
 * becomes a fingerprint compare + cache hit instead of a full rule
 * run.
 */
const FINGERPRINT_CACHE_CAP = 32;
const fingerprintCache = new Map<string, Warning[]>();

export const validate = (doc: TPDocument): Warning[] => {
  const cached = validateCache.get(doc);
  if (cached) return cached;

  // Reference miss; check the fingerprint cache before re-running rules.
  const fp = validationFingerprint(doc);
  const fpHit = fingerprintCache.get(fp);
  if (fpHit) {
    // Promote into the doc-reference cache so the next call with this
    // same reference takes the fast path, and LRU-bump the fingerprint
    // entry (delete + set).
    validateCache.set(doc, fpHit);
    fingerprintCache.delete(fp);
    fingerprintCache.set(fp, fpHit);
    return fpHit;
  }

  const result = RULES_BY_DIAGRAM[doc.diagramType].flatMap((r) =>
    r.fn(doc).map((w) => ({ ...w, tier: r.tier }))
  );
  validateCache.set(doc, result);
  fingerprintCache.set(fp, result);
  if (fingerprintCache.size > FINGERPRINT_CACHE_CAP) {
    const oldest = fingerprintCache.keys().next().value;
    if (oldest !== undefined) fingerprintCache.delete(oldest);
  }
  return result;
};

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

export { completeStepRule } from './completeStep';
// Re-export per-rule entry points that real consumers (tests, callers)
// import via `@/domain/validators`. Speculative re-exports for rules
// that no consumer references were dropped — tests can still target a
// single rule via direct `./clarity` imports if needed later, with no
// boilerplate cost.
export { ecMissingConflictRule } from './ecMissingConflict';
export { externalRootCauseRule } from './externalRootCause';
export type { UntieredWarning, ValidatorRule } from './shared';
