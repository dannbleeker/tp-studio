import { formatList, plural } from '../format';
import type { ClrParams } from '../types';

/**
 * The English catalogue — the single source of truth for the message shape.
 *
 * `Messages` is derived from this object (`type Messages = typeof en`), so
 * every other locale is structurally checked against it: a missing key, an
 * extra key, or a changed interpolation signature is a `tsc` error rather
 * than a runtime hole. That is the whole reason this is a typed object
 * literal and not a JSON file.
 *
 * Two value shapes are in play, on purpose:
 *   - Static copy is a plain string.
 *   - Interpolated copy is a `(params) => string` arrow. Making the function
 *     part of the *type* means a locale cannot quietly drop a parameter, and
 *     it keeps ICU-style placeholder parsing (and a dependency) out of the
 *     app entirely.
 *
 * BCP-47 tags are baked in at the `plural(...)` / `formatList(...)` call
 * sites rather than threaded through as an argument — the English catalogue
 * already knows it is English.
 */

const BCP47 = 'en';

/**
 * `ClrParams` values are deliberately loose (see `types.ts`) because the CLR
 * resolver is generic over ~57 heterogeneous messages. These coercers pull a
 * concrete type back out at the point of use. They are total: a wrong-typed
 * param yields a visibly broken string rather than throwing, and the legacy
 * `Warning.message` field renders through this same catalogue, so the
 * existing validator tests catch a mis-wired parameter immediately.
 */
type Param = ClrParams[string] | undefined;

const num = (v: Param): number => (typeof v === 'number' ? v : Number(v ?? 0));
const str = (v: Param): string => (Array.isArray(v) ? v.join(', ') : String(v ?? ''));
const list = (v: Param): readonly string[] =>
  Array.isArray(v) ? v : v === undefined ? [] : [String(v)];

/** Reading gloss per edge kind, used by the logic-type-mismatch message. */
const EDGE_KIND_NOUN: Record<string, string> = {
  sufficiency: 'sufficiency',
  necessity: 'necessity',
};
const EDGE_KIND_READING: Record<string, string> = {
  sufficiency: '"X exists, therefore Y"',
  necessity: '"in order to Y, X must hold"',
};
/** S&T assumption facets, named as nouns for the missing-assumption list. */
const ST_FACET_NOUN: Record<string, string> = {
  necessary: 'necessary',
  parallel: 'parallel',
  sufficiency: 'sufficiency',
};

export const en = {
  settings: {
    tabs: {
      appearance: 'Appearance',
      behavior: 'Behavior',
      display: 'Display',
      layout: 'Layout',
    },
    restoreDefaults: 'Restore defaults',
    appearance: {
      section: 'Appearance',
      theme: 'Theme',
      colorPalette: 'Color palette',
      language: 'Language',
      languageHint: 'More languages are on the way — the interface is English for now.',
      themes: {
        light: 'Light',
        dark: 'Dark',
        highContrast: 'High contrast',
        highContrastHint: 'Maximizes legibility',
        rust: 'Rust',
        rustHint: 'Warm dark, ember tones',
        coal: 'Coal',
        coalHint: 'Near-black, blue tint',
        navy: 'Navy',
        navyHint: 'Deep blue dark mode',
        ayu: 'Ayu',
        ayuHint: 'Warm dark, golden accents',
      },
      palettes: {
        default: 'Default',
        colorblindSafe: 'Colorblind-safe',
        colorblindSafeHint: 'Wong palette',
        mono: 'Monochrome',
      },
    },
  },

  /**
   * Reader / Trainee mode coaching copy. Mirrors the `CoachingEntry` shape in
   * `src/domain/readerModeCoaching.ts`, which now reads its strings from here.
   */
  coaching: {
    entity: {
      ude: {
        label: 'Undesirable Effect',
        tip: 'An observable symptom of the core problem. Collect several UDEs first — the root cause must explain all of them.',
      },
      effect: {
        label: 'Effect',
        tip: 'A condition produced by the cause below it. Effects chain upward until they reach an undesirable symptom or a desired outcome.',
      },
      rootCause: {
        label: 'Root Cause',
        tip: 'The deepest driver you can control or influence. A well-built tree converges on one or two root causes that feed most UDEs.',
      },
      injection: {
        label: 'Injection',
        tip: 'A proposed change that breaks the root cause. In a Future Reality Tree, injections drive the whole chain of desired effects upward.',
      },
      desiredEffect: {
        label: 'Desired Effect',
        tip: 'A positive outcome the injection is meant to produce. Desired effects replace UDEs in the Future Reality Tree.',
      },
      goal: {
        label: 'Goal',
        tip: 'The top-level outcome the whole system must achieve. In a Goal Tree, every element below is necessary for this goal.',
      },
      criticalSuccessFactor: {
        label: 'Critical Success Factor',
        tip: 'A major condition the goal depends on. If any CSF is unmet the goal cannot be achieved — there are no workarounds.',
      },
      necessaryCondition: {
        label: 'Necessary Condition',
        tip: 'A specific condition its parent CSF or goal requires. Necessary Conditions become the operational targets for plans and reviews.',
      },
      obstacle: {
        label: 'Obstacle',
        tip: 'A reason the Intermediate Objective above it has not yet been reached. Every IO in a PRT must name its obstacle explicitly.',
      },
      intermediateObjective: {
        label: 'Intermediate Objective',
        tip: 'A milestone that overcomes its named obstacle and moves the plan toward the injection at the top. Achieve the lowest IOs first.',
      },
      action: {
        label: 'Action',
        tip: 'A concrete step in the Transition Tree. Each action pairs a need (why this step) with an expected effect (what changes afterward).',
      },
      need: {
        label: 'Need',
        tip: 'In an Evaporating Cloud, a Need is what each Want is trying to satisfy. The tension lives in the needs, not the wants themselves.',
      },
      want: {
        label: 'Want',
        tip: 'One of the two conflicting requirements in the Evaporating Cloud. The cloud dissolves when you find the assumption behind one of the necessity arrows.',
      },
      note: {
        label: 'Note',
        tip: 'A free-floating annotation. Notes sit outside the logical graph and do not affect causality or necessity chains.',
      },
    },
    edge: {
      sufficiency: {
        label: 'Sufficiency arrow (→)',
        tip: 'Read: "If (cause), then (effect)." The cause is sufficient to produce the effect. To challenge: is the cause really sufficient, or is something else also needed?',
      },
      necessity: {
        label: 'Necessity arrow (←)',
        tip: 'Read: "In order to (parent), we must (child)." The child is required — without it the parent cannot be achieved. To challenge: is this truly necessary, or is there another way?',
      },
    },
  },

  /**
   * CLR warning copy, keyed by `<ruleId>` or `<ruleId>.<variant>`.
   *
   * Flat rather than nested because `validate()` has to emit a *serializable*
   * key: it runs below the React boundary and is memoized on `(doc)` alone
   * (a `WeakMap` plus a fingerprint LRU in `validators/index.ts`), so it
   * cannot resolve copy itself without breaking both caches. It emits
   * `{ messageKey, params }` and the inspector renders it.
   *
   * Enum-ish parameters (`expected`, `actual`, `missing`, `slot`) arrive as
   * raw domain tokens and are turned into nouns *here*, so a translator never
   * has to interpolate an untranslated English word into a sentence.
   */
  clr: {
    'additional-cause.no-causes': 'No causes captured. Are there causes you haven’t added?',
    'additional-cause.single-cause':
      'Only one cause is captured — could a different, independent cause also produce this effect? If so, add it and model the alternatives as an OR.',
    'additional-cause.two-causes':
      'Two independent causes feed this with no connector — is each one enough on its own (leave them separate, or model as an OR), or only enough together (group them as an AND)?',

    'causality-existence': 'Does the cause inevitably produce the effect?',

    'cause-effect-reversal.root-cause-incoming':
      'A Root Cause should not have incoming causes. Check the arrow: does that cause make this happen, or is it just how you know this is here? If the latter, the arrow is reversed.',
    'cause-effect-reversal.ude-outgoing':
      'A UDE should not have outgoing effects. Check the arrow: does this make the effect happen, or is the effect just how you know this UDE is here? If the latter, the arrow is reversed.',

    'cause-sufficiency': 'Is this cause alone enough? Consider grouping with another as an AND.',

    'clarity.too-long': (p: ClrParams) =>
      `Title is over ${num(p.limit)} words — tighten to one statement.`,
    'clarity.question': 'Statements should be declarative, not questions.',

    'complete-step':
      'Action has no precondition — what existing condition lets it produce this outcome?',

    'crt-low-core-driver-coverage': (p: ClrParams) =>
      `The leading root cause explains only ${num(p.reached)} of ${num(p.total)} UDEs (${num(p.pct)}%) — the tree may have two independent clusters, or some UDEs aren't connected yet.`,
    'crt-tied-core-drivers': (p: ClrParams) =>
      `Two root causes each reach ${num(p.count)} UDEs — no single core driver has emerged. A hidden conflict may sit beneath the tree; spawn an Evaporating Cloud to surface it.`,

    'crt-dead-branch': (p: ClrParams) =>
      `"${str(p.title)}" doesn't lead to any UDE — prune or archive it, or connect it into the causal chain.`,

    'crt-ude-count.too-few': (p: ClrParams) =>
      `This CRT has ${num(p.count)} ${plural(BCP47, num(p.count), { one: 'UDE', other: 'UDEs' })} — with fewer than ${num(p.min)}, a system-wide root cause is hard to trust. Add the other effects you're seeing.`,
    'crt-ude-count.too-many': (p: ClrParams) =>
      `This CRT has ${num(p.count)} UDEs — more than ${num(p.max)} usually means the scope is too wide for one tree; consider splitting it.`,

    'crt-ude-no-upstream': (p: ClrParams) =>
      `UDE "${str(p.title)}" has no cause feeding it — the tree is incomplete until it connects to the causal chain.`,
    'crt-ude-wording': (p: ClrParams) =>
      `UDE "${str(p.title)}" may describe the absence of a solution rather than an observable effect — try restating it as a concrete, present-tense fact.`,

    'ec-box-causal-words': (p: ClrParams) =>
      `EC box "${str(p.title)}" reads as a cause-and-effect sentence (if / because / in order to …) — a cloud box should be a clean statement. Move the reasoning onto the arrow as an assumption.`,

    'ec-completeness.empty-objective':
      'Objective (A) is empty — state the common goal both sides agree on.',
    'ec-completeness.needs-identical':
      'Needs B and C are the same entity — split them so each side has its own.',
    'ec-completeness.need-extra-support': (p: ClrParams) =>
      `Need ${str(p.slot).toUpperCase()} connects to something other than A — each Need must only support the Objective.`,
    'ec-completeness.want-wrong-target': (p: ClrParams) =>
      `Want ${str(p.slot) === 'd' ? 'D' : 'D′'} supports an unexpected target — each Want should feed only its own Need.`,
    'ec-completeness.missing-assumption': (p: ClrParams) =>
      `No assumption recorded on ${str(p.arrow)} — surface at least one before the cloud is "complete".`,
    'ec-completeness.no-injection':
      'No injection yet — add an injection that challenges an assumption to mark the cloud "resolved".',

    'ec-missing-conflict':
      'No mutual-exclusion edge between the two Wants — is this really a conflict?',

    'entity-existence.no-title': 'Entity has no title.',
    'entity-existence.disconnected': 'Entity is disconnected from the graph.',

    'entity-fragment': (p: ClrParams) =>
      `"${str(p.title)}" is a single word — a cause or effect should state what is happening (e.g. what it does, or how it is changing), not just name a thing.`,

    'entry-point':
      'This is an entry point — it has effects but nothing causes it — yet it is neither an injection nor marked true in current reality. Make it an injection, mark its state as holding today, or connect the cause that produces it.',

    'external-root-cause':
      'Root cause flagged as external — is it really the root? Keep digging toward something you control or influence.',

    'goalTree-compliance-csf': (p: ClrParams) =>
      `"${str(p.title)}" reads as compliance — that is usually a Necessary Condition a few layers down (a threshold you must not breach), not a make-or-break Critical Success Factor the goal is built around.`,
    'goalTree-multiple-goals': (p: ClrParams) =>
      `Goal Tree has ${num(p.count)} goals — Dettmer's pattern is a single apex Goal with 3-5 CSFs below.`,
    'goalTree-csf-no-ncs':
      'This Critical Success Factor has no Necessary Conditions beneath it — add the conditions that must hold for it.',
    'goalTree-csf-count.too-few': (p: ClrParams) =>
      `This Goal Tree has ${num(p.count)} ${plural(BCP47, num(p.count), { one: 'Critical Success Factor', other: 'Critical Success Factors' })} — Dettmer's pattern is typically ${num(p.min)}–${num(p.max)}; you may be missing some make-or-break conditions.`,
    'goalTree-csf-count.too-many': (p: ClrParams) =>
      `This Goal Tree has ${num(p.count)} Critical Success Factors — more than ${num(p.max)} usually means some are really Necessary Conditions a tier down.`,
    'goalTree-ncs-per-csf': (p: ClrParams) =>
      `This Critical Success Factor has ${num(p.count)} direct Necessary Conditions — Dettmer's checklist caps it at ${num(p.max)}; group some under an intermediate condition or trim the low-level ones.`,
    'goalTree-nc-depth': (p: ClrParams) =>
      `This Necessary Condition sits ${num(p.depth)} layers below a CSF — the limit here is ${num(p.max)}. Deeper detail is execution planning: consider trimming it here and developing it in a Prerequisite Tree.`,
    'goalTree-junctor':
      'A Goal Tree uses single arrows only — necessity children are implicitly conjoined, so an AND junctor is redundant and OR / XOR contradict the "in order to… we must…" reading. Ungroup this edge.',

    'id-interference-no-io':
      'This interference has no paired intermediate objective — add the injection that removes or reduces it.',
    'id-multiple-central-objectives': (p: ClrParams) =>
      `This Interference Diagram has ${num(p.count)} central objectives — an ID maps interferences around a single objective. Split the second one into its own diagram.`,

    'indirect-effect': (p: ClrParams) =>
      `${num(p.count)} direct causes — could some chain through intermediate effects?`,

    'logic-type-mismatch': (p: ClrParams) =>
      `This diagram reads in ${EDGE_KIND_NOUN[str(p.expected)] ?? str(p.expected)} logic ${EDGE_KIND_READING[str(p.expected)] ?? ''}, but this link is typed ${EDGE_KIND_NOUN[str(p.actual)] ?? str(p.actual)} — check that it reads correctly.`,

    'long-arrow': (p: ClrParams) =>
      `This arrow spans ${num(p.span)} causal levels — is a step missing between “${str(p.source)}” and “${str(p.target)}”?`,

    'loop-polarity.crt':
      'This loop is balancing (self-correcting) — but a persistent UDE usually rides a reinforcing (vicious) cycle. Check the edge polarities.',
    'loop-polarity.nbr':
      'This loop is balancing (self-correcting) — a negative branch that sustains itself usually rides a reinforcing cycle. Check the edge polarities.',
    'loop-polarity.frt':
      'This loop is balancing (self-limiting) — an injection that counteracts itself is usually unintended. Check the edge polarities.',

    'nbr-no-negative-branch':
      'No undesirable effect captured yet — trace the injection forward to where the chain turns negative ("yes, but…"). Without a UDE this still reads as an FRT.',
    'nbr-ude-disconnected': (p: ClrParams) =>
      `UDE "${str(p.title)}" doesn't trace back to the candidate injection — connect the chain (injection → … → UDE) or it can't inform the adopt / modify / reject call.`,

    'predicted-effect-existence':
      'If this injection holds, name one other effect it must also produce — then you can go and check for it. None captured yet.',

    'prt-obstacle-no-io':
      'This obstacle has no Intermediate Objective overcoming it — add the IO that removes it on the way to the goal.',
    'prt-io-no-obstacle':
      'This Intermediate Objective doesn’t overcome any obstacle — connect it to the obstacle it removes.',

    'reinforcing-no-delay':
      'This reinforcing loop has no delay — taken literally it escalates instantly. Is a time lag missing? Mark the lagged edge as delayed.',

    'st-tactic-assumptions': (p: ClrParams) => {
      const facets = list(p.missing).map((f) => ST_FACET_NOUN[f] ?? f);
      return `Step is missing its ${formatList(BCP47, facets)} ${plural(BCP47, facets.length, { one: 'assumption', other: 'assumptions' })}. A Strategy & Tactics step declares why it is needed (necessary — points up to its parent), why this tactic fits the strategy (parallel), and, when it has sub-steps, why those are needed (sufficiency — points down to its children).`;
    },
    'st-tactic-fold-in':
      'Step has only one sub-step — a Strategy & Tactics decomposition should split into two or more jointly-sufficient sub-steps, or fold the single sub-step back into this one.',
    'st-tactic-rollup':
      'Tactic has a parent but no child tactics — every non-leaf tactic should decompose into sufficient sub-tactics, or be intentionally a leaf.',

    tautology: 'This statement is nearly identical to its effect — possible tautology.',

    'tt-action-locus-unset':
      'Action has no locus set — flag it as control / influence / external so the plan reads honestly about authority.',
  },

  /** One-click remedy labels, keyed by `WarningAction.actionId`. */
  clrAction: {
    'spawn-ec-from-conflict': 'Spawn Evaporating Cloud',
    'convert-extra-goals-to-csfs': 'Convert extras to CSFs',
    'insert-step': 'Insert a step',
  },
};
// Deliberately NOT `as const`. `as const` would narrow every value to its own
// string literal type, so `Messages` would demand that a Danish catalogue
// contain the literal 'Undesirable Effect' — the exact opposite of what this
// type is for. Widened `string` values keep the SHAPE checked (keys present,
// interpolation signatures matching) while leaving the copy free.
