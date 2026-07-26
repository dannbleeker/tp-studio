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
  /** Shared primitives used by more than one surface. */
  common: {
    edit: 'Edit',
    preview: 'Preview',
  },

  settings: {
    tabs: {
      appearance: 'Appearance',
      behavior: 'Behavior',
      display: 'Display',
      layout: 'Layout',
    },
    restoreDefaults: 'Restore defaults',
    resetConfirm:
      'Reset every setting (Appearance / Behavior / Display / Layout) back to its factory default? Documents on the canvas are not affected.',
    resetConfirmLabel: 'Reset',
    resetDone: 'Settings restored to defaults.',
    behavior: {
      section: 'Behavior',
      animationSpeed: 'Animation speed',
      animationSpeedNote:
        '\u201CNormal\u201D follows your system\u2019s \u201Creduce motion\u201D accessibility setting \u2014 enable it in your OS and animations are minimised automatically.',
      speeds: {
        instant: 'Instant',
        instantHint: 'No animation',
        slow: 'Slow',
        default: 'Normal',
        defaultHint: '1\u00d7 baseline speed',
        fast: 'Fast',
      },
      browseLock: 'Browse Lock',
      browseLockHint:
        'Read-only mode \u2014 disables editing across the canvas, inspector, and shortcuts',
      autoSnapshot: 'Auto-snapshot while editing',
      autoSnapshotHint:
        'Periodically snapshot the current tree as you edit (every few minutes, only when it changed) so you can compare / restore / branch mid-session. Snapshots also fire on document swap regardless.',
      creationWizards: 'Creation wizards',
      goalTreeWizard: 'Goal Tree',
      goalTreeWizardHint:
        'Open the guided 5-step panel when you create a new Goal Tree. Off = empty canvas, you build manually.',
      ecWizard: 'Evaporating Cloud',
      ecWizardHint:
        'Open the guided 5-step panel when you create a new EC. Off = the 5 pre-seeded boxes appear ready to edit.',
      crtWizard: 'Current Reality Tree',
      crtWizardHint:
        'Open the guided 3-step UDE-elicitation panel when you create a new CRT. Off = empty canvas, you list UDEs manually.',
      selectionToolbar: 'Selection toolbar',
      selectionToolbarHint:
        'Show a small floating toolbar above the selected entity / edge with the top 3-5 verbs scoped to its kind. Off = palette + context menu only.',
      openDocsInNewTab: 'Open documents in new tabs',
      openDocsInNewTabHint:
        'On = importing, loading a pattern / template / example, or opening a shared link opens a new tab. Off = the load replaces the current document.',
    },
    display: {
      section: 'Display',
      annotationNumbers: 'Show annotation numbers',
      annotationNumbersHint: 'A small #N badge on each entity',
      entityIds: 'Show entity IDs',
      entityIdsHint: 'Mono-font caption below each title',
      growCards: 'Grow cards to fit text',
      growCardsHint:
        'Let entity cards grow taller to show the full title, up to 6 lines. Off keeps the fixed card height with a 2-line clamp.',
      reachBadge: 'Show UDE-reach badge',
      reachBadgeHint:
        'On each entity, a bottom-left pill counting how many UDEs it transitively reaches (the Core Driver signal). Hidden on diagrams without UDEs.',
      reverseReachBadge: 'Show root-cause-reach badge',
      reverseReachBadgeHint:
        'On each entity, a bottom-right pill counting how many root causes transitively feed it. Useful on Goal Trees / FRTs where multiple injections converge. Hidden on diagrams without root causes.',
      actionEligibility: 'Show action-eligibility badge',
      actionEligibilityHint:
        'On Transition Tree Action nodes, a right-edge \u2713 / \u2717 / \u2026 pill: eligible (every precondition true), blocked (one is false), or pending (undecided). Reflects entity states; the full readout is in the Inspector.',
      minimap: 'Show minimap',
      minimapHint: 'Bottom-left thumbnail of the whole diagram',
      inkSaver: 'Ink-saving print mode',
      inkSaverHint:
        'When on, Print / Save as PDF drops colour fills (only the entity-type label is colorized)',
      causalityReading: 'Causality reading',
      causality: {
        none: 'None',
        noneHint: 'No fallback label',
        auto: 'Auto',
        autoHint: 'CRT/FRT/TT \u2192 "because", PRT/EC \u2192 "in order to"',
        because: 'Because',
        becauseHint: 'Sufficient-cause read, bottom-up',
        therefore: 'Therefore',
        thereforeHint: 'Sufficient-cause read, top-down',
        inOrderTo: 'In order to',
        inOrderToHint: 'Necessary-condition read (PRT/EC)',
      },
      defaultDirection: 'Default direction for new documents',
      directions: {
        auto: 'Auto',
        autoHint: 'Each diagram type picks its own default',
        bt: 'Bottom \u2192 Top',
        btHint: 'CRT / FRT default',
        tb: 'Top \u2192 Bottom',
        lr: 'Left \u2192 Right',
        rl: 'Right \u2192 Left',
      },
      layoutDensity: 'Layout density',
      density: {
        compact: 'Compact',
        compactHint: 'Pull entities closer (0.75\u00d7 spacing) \u2014 dense maps',
        balanced: 'Balanced',
        balancedHint: 'Default \u2014 tightened in Session 136',
        spacious: 'Spacious',
        spaciousHint: 'Loosen for projector / accessibility (1.5\u00d7 spacing)',
      },
      edgeRouting: 'Edge routing',
      routing: {
        smart: 'Smart (avoid obstacles)',
        smartHint: 'Routes edges around non-endpoint node bodies (default)',
        direct: 'Direct (curves through anything)',
        directHint: 'Pre-routing behavior \u2014 every edge is React Flow\u2019s default bezier',
      },
    },
    layout: {
      section: 'Layout',
      direction: 'Direction',
      directions: {
        bt: 'Bottom \u2192 Top',
        btHint: 'Default for CRT / FRT',
        tb: 'Top \u2192 Bottom',
        tbHint: 'Goal at top',
        lr: 'Left \u2192 Right',
        rl: 'Right \u2192 Left',
      },
      compactness: 'Compactness',
      compactnessHint:
        'Tighten or loosen the spacing dagre uses between entities. 50 is the app default.',
      bias: 'Bias',
      biases: {
        auto: 'Auto',
        autoHint: 'Dagre balances',
        ul: 'Upper-left',
        ur: 'Upper-right',
        dl: 'Lower-left',
        dr: 'Lower-right',
      },
      resetLayout: 'Reset layout to defaults',
      resetToDefaults: 'Reset to defaults',
    },
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
   * Document Inspector dialog.
   *
   * Interpolated entries here take a CONCRETE param object, unlike the `clr`
   * section's loose `ClrParams`. The CLR resolver has to be generic over ~57
   * heterogeneous messages routed through one channel; these are called
   * directly from the component, so the signature can be exact and `tsc`
   * checks the call site.
   */
  docInspector: {
    heading: 'Document',
    close: 'Close document inspector',
    title: 'Title',
    author: 'Author',
    authorPlaceholder: 'Optional',
    description: 'Description',
    descriptionPlaceholder: "Goal of this tree, who it's for, what's in scope — supports markdown.",
    documentWarnings: 'Document-level warnings',

    systemScope: 'System Scope',
    scopeAnswered: (p: { answered: number; total: number }) => `${p.answered}/${p.total} answered`,
    scopeIntro:
      'CRT Step 1 — answer these before drawing entities. The discipline pays back as the tree grows.',
    scope: {
      goal: 'System goal',
      goalPlaceholder: 'What is this system / situation for?',
      necessaryConditions: 'Necessary conditions for the goal',
      necessaryConditionsPlaceholder:
        'What must be true (in the world) for the goal to be reachable?',
      successMeasures: 'Measurements of success',
      successMeasuresPlaceholder:
        "How will we know it's working? Specific, observable, quantifiable.",
      boundaries: 'System boundaries',
      boundariesPlaceholder:
        "What's inside the system under analysis vs. context that just affects it?",
      containingSystem: 'Containing system',
      containingSystemPlaceholder: 'What larger system / organization / process is this inside?',
      interactingSystems: 'Interacting systems',
      interactingSystemsPlaceholder:
        'Other systems that significantly affect or are affected by this one.',
      inputsOutputs: 'Inputs / outputs',
      inputsOutputsPlaceholder: 'What flows in (work, materials, information) and what flows out?',
    },

    performanceFrame: 'Performance frame',
    anchorsFilled: (p: { filled: number }) => `${p.filled}/2 anchors`,
    performanceIntro:
      "Frame the gap this diagram closes: the measure's current (unacceptable) level and its target (desired) level. Optional — a facilitation note that travels with the document.",
    performanceLow: 'Low — current / unacceptable',
    performanceLowPlaceholder: 'e.g. On-time delivery sits at 60%.',
    performanceHigh: 'High — target / desired',
    performanceHighPlaceholder: 'e.g. Reach 98% on-time delivery within two quarters.',

    methodChecklist: 'Method checklist',
    stepsDone: (p: { done: number; total: number; diagram: string }) =>
      `${p.done}/${p.total} steps — ${p.diagram}`,
    methodIntro:
      'The canonical recipe for this diagram type. Each step is roughly one focused work session.',
    // The ordinal separator is part of the copy, not punctuation the component
    // should assume: not every locale numbers a list "1." — some use "1)" and
    // some use different numerals entirely.
    methodStep: (p: { n: number; label: string }) => `${p.n}. ${p.label}`,

    ecVerbalStyle: 'EC verbal style',
    ecNeutral: 'Neutral ("we must")',
    ecTwoSided: 'Two-sided ("I" vs "they")',
    ecVerbalStyleNote:
      'Switches the verbalisation strip between the workshop-default neutral voice ("In order to A, we must B") and the BESTSELLER PPT\'s two-party framing ("they want to" / "I want to") that surfaces the felt negotiation.',

    cloudType: 'Cloud type',
    cloudTypeUntyped: '— Untyped',
    cloudTypeNote:
      "Optional — marks this cloud's role in the progression (UDE → Consolidated → Core), per Cohen's TP Basics. The creation wizard reads it to tailor the build order and prompts; afterwards it keeps Cohen's break hint to hand.",
    bestArrowToBreak: 'Best arrow to break',

    statType: 'Type',
    statEntities: 'Entities',
    statEdges: 'Edges',
  },

  /**
   * Per-diagram-type method checklist copy, keyed by step id.
   *
   * The ids are already part of the JSON wire format (a doc's `methodChecklist`
   * map is keyed by them), so they were the natural catalogue keys — there is no
   * second key to keep in sync. `methodChecklist.ts` keeps the ids and their
   * per-diagram ORDER; only the copy lives here.
   */
  method: {
    'crt.scope': {
      label: 'Define the system scope',
      hint: 'Fill in the System Scope section above — goal, boundaries, success measures.',
    },
    'crt.udes': {
      label: 'List 3–5 critical UDEs',
      hint: 'The painful effects you want to eliminate. Concrete, observable, present-tense.',
    },
    'crt.connect': {
      label: 'Connect UDEs into causal chains',
      hint: 'Read each edge aloud as "X exists, therefore Y exists." If it doesn\'t read true, restructure.',
    },
    'crt.deepen': {
      label: 'Build down to root causes',
      hint: 'Keep asking "why does this happen?" until you hit a cause you actually control or influence.',
    },
    'crt.clr': {
      label: 'Apply CLR challenges at every step',
      hint: 'Clarity → Existence → Sufficiency. Resolve each open warning or restructure the diagram.',
    },
    'crt.span': {
      label: 'Test against your locus — control / influence / external',
      hint: 'A root cause outside what you can affect is rarely the real root — keep digging.',
    },
    'crt.loops': {
      label: 'Look for reinforcing loops',
      hint: 'Vicious circles explain why UDEs persist. Tag loop-closing edges as back-edges (right-click the edge).',
    },
    'crt.archive': {
      label: "Archive rejected branches, don't delete them",
      hint: 'Move pruned alternatives into a group so the path-not-taken stays visible.',
    },
    'crt.core': {
      label: 'Identify the Core Driver',
      hint: 'Run "Find core driver(s)" from the palette — the single cause whose elimination clears the most UDEs.',
    },
    'frt.scope': {
      label: 'Define the desired future state',
      hint: 'Use the System Scope section — what does success look like, measurably?',
    },
    'frt.injections': {
      label: 'Choose your initial injections',
      hint: "The actions or conditions you'll introduce into the system. Start with one; add more as the tree demands.",
    },
    'frt.build': {
      label: 'Build up causal chains to the Desired Effects',
      hint: 'Each edge should read "X exists, therefore Y exists" — the injections drive the desired effects via intermediate states.',
    },
    'frt.clr': {
      label: 'Apply CLR challenges, especially predicted-effect existence',
      hint: 'Are the predicted intermediate effects realistic? Are sufficient conditions stated?',
    },
    'frt.negative': {
      label: 'Watch for Negative Branches',
      hint: 'Each injection can spawn unintended UDEs. Capture them as a sub-tree and either mitigate or pick a different injection.',
    },
    'frt.reinforce': {
      label: 'Design positive reinforcing loops',
      hint: 'Self-sustaining loops where success feeds itself. Tag the loop-closing edge as a back-edge to model it explicitly.',
    },
    'prt.scope': {
      label: 'State the ambitious objective',
      hint: 'Use the System Scope section — what would be a clearly bold but achievable target?',
    },
    'prt.obstacles': {
      label: 'Identify the obstacles in the way',
      hint: "What's keeping you from the objective? Brainstorm freely; you'll prune later.",
    },
    'prt.io': {
      label: 'For each obstacle, define an Intermediate Objective',
      hint: 'The condition that, once met, removes that obstacle. Pair them 1-to-1 if possible.',
    },
    'prt.sequence': {
      label: 'Sequence the IOs',
      hint: 'Which IOs depend on others? PRT reads bottom-up — earliest prerequisites at the bottom.',
    },
    'prt.clr': {
      label: 'Apply CLR challenges',
      hint: 'Especially entity-existence (is this really an obstacle?) and sufficiency (does meeting the IO actually remove it?).',
    },
    'prt.archive': {
      label: 'Archive pruned alternatives',
      hint: "Don't delete considered-but-rejected IOs — group + collapse them so the rationale stays.",
    },
    'tt.scope': {
      label: 'State the desired outcome',
      hint: "Use the System Scope section — what's the end state this plan produces?",
    },
    'tt.actions': {
      label: 'List the actions required',
      hint: 'The do-something steps. Action-verb framing: "Audit X," "Draft Y," "Roll out Z."',
    },
    'tt.preconditions': {
      label: 'Identify a precondition for each action',
      hint: "The existing reality that lets each action work. If you can't name it, use an Unspecified placeholder (EntityInspector checkbox) and come back.",
    },
    'tt.triples': {
      label: 'Build the (Action + Precondition → Outcome) triples',
      hint: 'Each step is structurally complete when its outcome has BOTH an action and a non-action precondition feeding it.',
    },
    'tt.appropriate-condition': {
      label: 'Test each action for its appropriate condition',
      hint: 'For every action ask two things (Ch. 20 Layer 7; Ch. 25): (1) can you actually take it — is it within your span of control, and its precondition true? and (2) will it avoid serious negative side-effects (spin off a Negative Branch Reservation if you are unsure)? Record the "why" of each action in its Need field.',
    },
    'tt.clr': {
      label: 'Apply CLR challenges (including Complete-Step)',
      hint: 'The TT-specific Complete-Step rule fires on any action whose outcome lacks a precondition sibling.',
    },
    'tt.unspecified': {
      label: 'Capture inarticulate reservations as Unspecified placeholders',
      hint: "When you sense something belongs but can't name it yet, add a placeholder Precondition and keep moving.",
    },
    'ec.conflict': {
      label: 'State the recurring conflict in two sentences',
      hint: '"I want X, but I also want Y\'." Verbalize before drawing.',
    },
    'ec.goal': {
      label: 'Articulate the common goal both sides serve',
      hint: 'The Goal box (leftmost) — what positive outcome both Wants are trying to produce.',
    },
    'ec.needs': {
      label: 'Name both Needs',
      hint: 'Each Need is the prerequisite condition the corresponding Want is trying to satisfy.',
    },
    'ec.syntax': {
      label: 'Tidy the box wording — clean statements, right kinds',
      hint: 'Each box is a statement, not a cause-and-effect sentence (no "if / because / in order to" — those belong on the arrows). D and D′ are actions; B and C are the positive needs they serve.',
    },
    'ec.verbalize': {
      label: 'Verbalize each edge as a necessary-condition statement',
      hint: '"In order to satisfy [Need], we must obtain [Want]" — read every edge aloud before continuing.',
    },
    'ec.jeopardy': {
      label: 'Read the diagonals — does each side jeopardize the other?',
      hint: 'Say it aloud: "Doing D puts need C in jeopardy; doing D′ puts need B in jeopardy." If a diagonal doesn\'t bite, the conflict isn\'t real yet.',
    },
    'ec.assumptions': {
      label: 'Brainstorm "…because" assumptions on each edge',
      hint: 'Every assumption should start with "…because" — the new-assumption input pre-fills the prefix on EC edges.',
    },
    'ec.clr': {
      label: 'Apply CLR challenges on each assumption',
      hint: 'Especially clarity (is it stated as a fact rather than an opinion?) and existence (is it actually true here?).',
    },
    'ec.injection': {
      label: 'Find an injection that breaks the conflict',
      hint: 'A condition that lets you have both Wants — or makes one Want unnecessary. Spawn a follow-up FRT to test it.',
    },
    'st.analysis-first': {
      label: 'Do the analysis first — the Strategy & Tactics tree comes last',
      hint: 'Run the full diagnosis before deploying: a Current Reality Tree to find the core problem, an Evaporating Cloud to surface the conflict, a Future Reality Tree to test the fix. Every assumption you record here should already be a validated fact of life — the Strategy & Tactics tree replaces the Prerequisite Tree as the deployment document.',
    },
    'st.apex': {
      label: 'State the apex strategy',
      hint: 'The top-level objective the whole tree decomposes from — what does success at the highest level look like? The apex has no parent, so it carries no necessary assumption.',
    },
    'st.tactic': {
      label: 'Name the tactic that achieves the strategy',
      hint: 'The "how" of the current step. Action-verb framing: "Re-engineer X," "Establish Y," "Roll out Z." The strategy is the outcome (what); the tactic is the action (how).',
    },
    'st.na': {
      label: 'State the Necessary Assumption (why the step is needed)',
      hint: 'Why must this step exist at all? The necessary assumption justifies the step UPWARD to its parent — what the level above needs from it. The apex has none (nothing sits above it).',
    },
    'st.pa': {
      label: 'State the Parallel Assumption (why this tactic fits)',
      hint: 'Why is THIS tactic the right way to reach the strategy, versus the alternatives? The parallel assumption bridges the step’s own strategy and tactic — "if the strategy and these assumptions hold, then this tactic."',
    },
    'st.sa': {
      label: 'State the Sufficiency Assumption (why it needs sub-steps)',
      hint: "Why isn't this step enough on its own? The sufficiency assumption justifies breaking it DOWNWARD into sub-steps that are jointly sufficient. A leaf, with no children, carries none.",
    },
    'st.decompose': {
      label: 'Decompose into two or more jointly-sufficient sub-steps',
      hint: 'Split the step into the sub-steps that together are sufficient for it — two or more (a single sub-step should fold back in). Each sub-step’s strategy is what the parent tactic needs from it. Repeat until a named team can plan against the leaf.',
    },
    'nbr.injection': {
      label: 'State the candidate injection',
      hint: 'The change you\'re considering. Concrete and singular — "we add a 1-week QA gate", not "improve quality".',
    },
    'nbr.forward': {
      label: 'Trace forward to the desired effects',
      hint: "The reason you'd adopt this injection in the first place. Same chains as an FRT.",
    },
    'nbr.turning-point': {
      label: 'Identify the negative-branch turning point',
      hint: 'The first effect where the chain starts heading somewhere bad. Often a side-consequence the FRT skipped.',
    },
    'nbr.udes': {
      label: 'Articulate each UDE in the branch',
      hint: 'Present-tense, observable, concrete. Same standard as CRT UDEs.',
    },
    'nbr.mitigation': {
      label: 'Choose mitigation: reactive or proactive',
      hint: "Reactive = an action that breaks the chain after the UDE starts. Proactive = swap the original injection for one that doesn't spawn the branch.",
    },
    'nbr.clr': {
      label: 'Apply CLR to the branch',
      hint: "A weak NBR is one where the UDE actually wouldn't follow — challenge the if-then steps before you over-invest in mitigation.",
    },
    'nbr.decision': {
      label: 'Decide: adopt, modify, or reject the injection',
      hint: 'Capture the call so a reviewer six months from now knows you considered the branch and chose deliberately.',
    },
    'goalTree.system': {
      label: 'Define the system boundary',
      hint: 'Whose tree is this — company, division, team, yourself? The boundary decides who owns the Goal and which conditions are inside your reach.',
    },
    'goalTree.goal': {
      label: 'State the Goal',
      hint: "One sentence. What is the single outcome the system exists for? Frame it as the positive end-state, not a problem — and get the system's owners to agree to it.",
    },
    'goalTree.csfs': {
      label: 'List 3–5 Critical Success Factors',
      hint: 'The few high-level objectives that, together, achieve the Goal. Each must be necessary — the last milestones before the Goal can be declared met.',
    },
    'goalTree.ncs': {
      label: 'For each CSF, identify Necessary Conditions',
      hint: 'What MUST be in place for this CSF? Read each edge as "in order to {CSF}, we must {NC}." Keep to 3–5 per CSF and at most two NC layers — deeper detail is execution planning (a PRT).',
    },
    'goalTree.verify': {
      label: 'Test necessity at every layer',
      hint: "If a parent could still be achieved without a child, that child isn't necessary — restructure.",
    },
    'goalTree.gaps': {
      label: 'Look for missing conditions',
      hint: "Conjoin all children of a parent. If the conjunction doesn't guarantee the parent, you're missing one.",
    },
    'goalTree.scrutiny': {
      label: 'Enlist outside scrutiny',
      hint: 'Share the tree (copy a share link) and collect comments: missing CSFs or NCs, wrong connections, low-level NCs to trim. Stop when a fresh reader adds nothing.',
    },
    'id.objective': {
      label: 'State the central objective',
      hint: "The one thing you want more of — either 'fully exploit the constraint' or a strategic goal. It sits at the hub; keep it high enough to matter to everyone in the room.",
    },
    'id.interferences': {
      label: 'Surface the interferences',
      hint: 'Ask "what stops us getting more of that?" Add each obstacle around the objective. Keep statements short, and let the people who do the work name them — filter gripes from real system interferences.',
    },
    'id.quantify': {
      label: 'Quantify the time each steals',
      hint: 'Estimate the time each interference costs (minutes per day or week, consistent units). This ranks them by impact so you focus on the vital few — the Pareto move.',
    },
    'id.injections': {
      label: 'Pair each interference with an injection',
      hint: 'For every interference ask "what must exist so this is no longer a problem?" That intermediate objective is the fix — one per interference.',
    },
    'id.act': {
      label: 'Attack the biggest interferences first',
      hint: "Reduce or eliminate the top-ranked interferences to free the most time; the ones you can't remove (breaks, lunch), off-load or cover instead.",
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
