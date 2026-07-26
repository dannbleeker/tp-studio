// Session 130 — split from `domain/types.ts`. Diagram type registry +
// CLR (Categories of Legitimate Reservation) warning model. All string
// unions + the lightweight Warning record; no imports from elsewhere
// in the types/ folder.

import type { ClrActionId, ClrMessageKey, ClrParams } from '@/i18n/types';

export type DiagramType =
  | 'crt'
  | 'frt'
  | 'prt'
  | 'tt'
  | 'ec'
  // Session 77 / brief §5 — Goal Tree (Dettmer's Intermediate Objectives
  // Map). Three-layer necessity-logic tree: Goal at top, 3-5 Critical
  // Success Factors below, Necessary Conditions nested under those.
  // Edges read "in order to {parent}, we must {child}". Uses existing
  // `goal` / `criticalSuccessFactor` / `necessaryCondition` entity types.
  | 'goalTree'
  // Bundle 10 / FL-DT4 — Goldratt's Strategy & Tactics Tree. A hierarchical
  // goal-decomposition tree: each level pairs a Strategy ("what we want at
  // this layer") with a Tactic ("how we achieve it"), broken down recursively
  // into child Strategies. We surface the canonical TOC entity types
  // (`goal` for apex strategies, `injection` for tactics, `necessaryCondition`
  // for the assumption facets, plus `assumption` and `effect` for tree-wide
  // metadata). The "diagram type" is a thin shell — palette + method
  // checklist + label — over the existing entity model.
  | 'st'
  // Bundle 10 / FL-DT5 — Free-form diagram. No TOC type constraints. The
  // palette is just `note` + `effect` + any custom entity classes the
  // user defines per-doc; CLR rules skip everything that pattern-matches
  // on specific built-in types. Useful for argument-mapping, brainstorm
  // boards, dependency sketches that don't fit a TOC pattern.
  | 'freeform'
  // Session 134 / spec major gap #5 — Negative Branch Reservation. A
  // forward-looking sub-tree from an injection that traces *undesirable*
  // consequences, the dual of the FRT's desired-effect chain. The
  // canonical shape: injection at the bottom, an intermediate effect
  // (the "turning point"), then one or more UDEs above, with attached
  // mitigation injections (reactive) or replacement injections
  // (proactive redesign) that prevent the branch. Edges read
  // sufficient-cause forward — same framing as FRT.
  | 'nbr'
  // Interference Diagram (Sproull & Nelson, *Epiphanized*, App. 4; orig.
  // Bob Fox, TOC Center). A hub-and-spoke map for answering "what to change"
  // fast without a full CRT: a single central objective (either "exploit the
  // constraint" or a strategic goal), a ring of `obstacle` interferences that
  // block it — each optionally carrying a quantified time/impact value — and a
  // paired `intermediateObjective` per interference. Unlike the logic trees the
  // arrows are NON-logical "intuition" arrows (no sufficiency/necessity), so no
  // causal CLR rules run. Thin shell over the entity model, forced radial.
  | 'id';

export type ClrRuleId =
  | 'clarity'
  | 'entity-existence'
  | 'causality-existence'
  | 'cause-sufficiency'
  | 'additional-cause'
  | 'cause-effect-reversal'
  | 'predicted-effect-existence'
  | 'tautology'
  // Bucket E (Session 46) CLR rule extensions:
  | 'indirect-effect'
  | 'cycle'
  // TT-specific (Session 53, "Thinking with Flying Logic" reading):
  | 'complete-step'
  // EC-specific (Session 57, "Thinking with Flying Logic" reading):
  | 'ec-missing-conflict'
  // Mental-model nudge (Session 59, "Thinking with Flying Logic" reading):
  | 'external-root-cause'
  // S&T-specific (Session 76, Bundle 10 follow-up): a tactic without
  // explicit Necessary / Parallel / Sufficiency assumption facets.
  | 'st-tactic-assumptions'
  // EC-specific (Session 77, brief §6): the 5-rule structural +
  // completeness check (empty A, B≡C, B/C only feed A, D/D′ only feed
  // their need, missing assumption per arrow, missing injection).
  | 'ec-completeness'
  // EC-specific (Session 198, backlog D3): a cloud box whose title reads as a
  // cause-and-effect sentence (if / because / in order to …). Cohen's syntax
  // rule (Handbook Ch. 24) — boxes are clean statements; causality lives on
  // the arrows. Soft clarity nudge.
  | 'ec-box-causal-words'
  // Goal Tree-specific (Session 79): more than one apex `goal` entity
  // on a Goal Tree document. Soft warning — the user can dismiss it
  // and continue, OR click the action button to convert extra goals
  // into Critical Success Factors. Dettmer's pattern is single-apex
  // but TP Studio doesn't enforce it as a hard constraint.
  | 'goalTree-multiple-goals'
  // Session 135 / medium-gap close — TT action-locus check. The method
  // checklist asks "Test against your locus — control / influence /
  // external" but until now the validator suite didn't enforce it.
  // Fires on `action` entities without an explicit `spanOfControl`
  // set. Tier: clarity (the question is "have you stated this in a
  // way you can act on?"). One row per under-specified action.
  | 'tt-action-locus-unset'
  // Session 135 / medium-gap close — S&T tactic-rollup sufficiency.
  // Goldratt's S&T pattern: every tactic at a given layer must
  // decompose into child tactics that, taken together, are sufficient
  // for the parent. We can't check semantic sufficiency, but we CAN
  // check that a non-leaf `injection` (tactic) has at least one
  // child injection feeding it via the structural graph. A tactic
  // with no children that ISN'T explicitly marked leaf is suspicious.
  | 'st-tactic-rollup'
  // Session 198 (backlog B, Ch.34 Ferguson): a Strategy & Tactics step that
  // decomposes into exactly ONE sub-step — a real decomposition needs ≥2
  // jointly-sufficient children, else the single child should fold back in.
  | 'st-tactic-fold-in'
  // Session 179 — external-source review batch (docs/EXTERNAL_TP_SOURCE_REVIEW.md).
  // Theme B — CRT build-quality nudges:
  | 'crt-dead-branch' // a non-UDE entity that leads to no UDE (trim it)
  | 'crt-ude-no-upstream' // a UDE with no incoming cause (tree incomplete)
  | 'crt-low-core-driver-coverage' // top root cause explains < half the UDEs
  | 'crt-tied-core-drivers' // 2+ root causes tie for top → hidden conflict?
  | 'crt-ude-wording' // a UDE phrased as the absence of a solution
  | 'crt-ude-count' // CRT scoped to too few / too many UDEs
  // Theme C2 — logic-type consistency:
  | 'logic-type-mismatch' // an edge whose kind contradicts the diagram's primary logic
  // Theme A2 — loop semantics (the System-Dynamics lens):
  | 'loop-polarity' // a balancing loop where a reinforcing one is expected
  // Session 180 (E5) — long-arrow / missing-step (a Causality-Existence
  // reservation): a sufficiency edge that jumps past ≥ 2 causal levels.
  | 'long-arrow'
  // Session 180 (Theme A / A4) — a reinforcing loop none of whose edges carries
  // a delay (it would escalate instantly — a lag is probably un-modelled).
  | 'reinforcing-no-delay'
  // Session 181 — NBR shape rules (closes the "NBR validator gap" flag). The
  // canonical NBR walks injection → forward chain → turning point → UDEs; the
  // method checklist teaches it and the risk-register export assumes it, so the
  // validator now checks the two structurally-verifiable halves:
  | 'nbr-no-negative-branch' // tracing started but no UDE captured — it's still an FRT
  | 'nbr-ude-disconnected' // a wired-up UDE that doesn't trace back to any injection
  // Session 192 (improvement review) — PRT + Goal-Tree structural rules (both
  // diagram types previously had NO type-specific validators despite a fully-
  // defined obstacle↔IO / Goal→CSF→NC structure):
  | 'prt-obstacle-no-io' // an obstacle with no Intermediate Objective overcoming it
  | 'prt-io-no-obstacle' // an IO that overcomes no obstacle
  | 'goalTree-csf-no-ncs' // a Critical Success Factor with no Necessary Conditions beneath it
  | 'goalTree-csf-count' // Goal Tree scoped to too few / too many CSFs
  // Session 195 — three build-discipline nudges from Dettmer's abbreviated
  // IO-Map construction checklist (The Logical Thinking Process 2007,
  // Fig 3.14): ≤ 3–5 NCs per CSF, ≤ two NC layers (deeper is execution
  // planning — PRT territory), and single arrows only (no AND/OR/XOR
  // junctors — necessity children are implicitly conjoined).
  | 'goalTree-ncs-per-csf' // more than five direct NCs under one CSF
  | 'goalTree-nc-depth' // an NC nested deeper than two layers below a CSF
  | 'goalTree-junctor' // a grouped (AND/OR/XOR) edge in a Goal Tree
  // Session 199 (backlog A1) — CLR wording + new soft warnings:
  // A single-word entity title on a causal / necessity tree — a cause or effect
  // should be a complete statement of what is happening, not a bare label
  // (the entity-existence "not a complete sentence" reservation). Soft clarity nudge.
  | 'entity-fragment'
  // A law / regulation / compliance condition set as a Critical Success Factor
  // on a Goal Tree — compliance is usually a Necessary Condition a few layers
  // down, not a make-or-break CSF (Dettmer). Soft clarity nudge.
  | 'goalTree-compliance-csf'
  // Session 199 (backlog A2, Scheinkopf NBR section) — the entry-point rule for
  // Future Reality Trees / Negative Branch Reservations: a "cause-only" node
  // (something with effects but nothing causing it) must be an injection you will
  // introduce OR a condition asserted true in current reality — otherwise it is
  // an unstated assumption holding the branch up. Existence tier.
  | 'entry-point'
  // Interference Diagram structural rules. The ID has no sufficiency/necessity
  // logic (its arrows are intuition), so these two are the only ID-specific
  // reservations — both structural, both soft:
  | 'id-interference-no-io' // an interference with no paired intermediate objective
  | 'id-multiple-central-objectives'; // more than one central objective (goal) on one ID

/**
 * Three-level CLR taxonomy used by Block C's tiered warning view. Each
 * `ValidatorRule` declares which tier it belongs to so `WarningsList` can
 * group rendered warnings under CLARITY / EXISTENCE / SUFFICIENCY headers
 * (matching how TOC practitioners discuss CLR challenges in workshops).
 */
export type ClrTier = 'clarity' | 'existence' | 'sufficiency';

/**
 * What a CLR warning is anchored to. `document` (Session 181) is for rules
 * whose subject is the diagram as a whole (UDE count, missing negative
 * branch) — they used to anchor on an arbitrary "earliest" entity as a
 * stand-in, which made their warning ids unstable (deleting / re-wiring the
 * stand-in re-keyed the warning and orphaned the user's stored resolution).
 * Document warnings render in the Document Inspector + the CLR walkthrough
 * rather than a selection inspector.
 */
export type WarningTarget =
  | { kind: 'entity'; id: string }
  | { kind: 'edge'; id: string }
  | { kind: 'document' };

/**
 * Session 79 — actionable warnings. Some CLR rules carry an
 * optional one-click remedy ("Convert extras to CSFs", "Mark mutex
 * edge", etc.) that lets the user fix the underlying issue without
 * leaving the WarningsList. The action id resolves to a handler in
 * `services/warningActions.ts`; the handler receives the live doc +
 * warning and dispatches store mutations.
 */
export type WarningAction = {
  /** Stable id resolved against the WARNING_ACTIONS registry at click time —
   *  and, since it is already a stable key, the catalogue key for the button
   *  label (see `resolveClrActionLabel`). */
  actionId: ClrActionId;
  /** English label. Same fallback contract as `Warning.message`. */
  label: string;
};

export type Warning = {
  id: string;
  ruleId: ClrRuleId;
  /**
   * Copy rendered in ENGLISH, always — `validate()` is memoized on the
   * document alone (a `WeakMap` plus a fingerprint LRU in
   * `validators/index.ts`), so resolving copy per-locale in here would mean
   * keying both caches on the locale too.
   *
   * Renderers should prefer {@link messageKey} and treat this as the fallback.
   * It is retained deliberately rather than removed: it keeps every existing
   * message assertion working, and because it renders through the same
   * catalogue entry the UI uses, a mis-named interpolation parameter shows up
   * immediately in the validator tests instead of silently reaching a user.
   */
  message: string;
  /** Catalogue key for {@link message}; resolved by `resolveClrMessage`. */
  messageKey?: ClrMessageKey;
  /** Interpolation parameters for {@link messageKey}. */
  params?: ClrParams;
  target: WarningTarget;
  resolved: boolean;
  /** Three-level CLR taxonomy (Block C / E5). Stamped by `validate()` from
   *  the rule's tier registration; never set inside individual rule files
   *  (the rule doesn't need to know its own tier — the composition layer
   *  is the source of truth). */
  tier: ClrTier;
  /** Session 79 — optional one-click remedy. WarningsList renders a
   *  small button next to the message; clicking dispatches the named
   *  action. Missing on warnings that have no obvious one-click fix
   *  (the bulk of CLR rules). */
  action?: WarningAction;
};
