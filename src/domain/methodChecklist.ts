import type { DiagramType } from './types';

/**
 * Per-diagram-type method checklist — the canonical recipe each TOC tree
 * comes with in the book. Loading a diagram type without ever having
 * worked through these steps tends to produce technically-valid but
 * structurally-shallow analyses; the checklist is the procedural
 * scaffolding the book repeatedly calls out as the discipline behind a
 * good tree.
 *
 * The step ids are stable, lowercase, dot-prefixed by diagram type
 * (`crt.scope`, `frt.injections`, etc.) so a doc's `methodChecklist` map
 * survives a switch of diagram type without colliding — unknown keys are
 * silently ignored on read. Updating a step's label is fine, but changing
 * an id is a breaking change that drops the existing checkmark; treat ids
 * as part of the JSON wire format.
 *
 * Labels and hints are kept concise; the checklist is meant to be glanceable
 * in the Document Inspector dialog, not a full method tutorial.
 */

export type MethodStep = {
  id: string;
  label: string;
  hint?: string;
};

const CRT: MethodStep[] = [
  {
    id: 'crt.scope',
    label: 'Define the system scope',
    hint: 'Fill in the System Scope section above — goal, boundaries, success measures.',
  },
  {
    id: 'crt.udes',
    label: 'List 3–5 critical UDEs',
    hint: 'The painful effects you want to eliminate. Concrete, observable, present-tense.',
  },
  {
    id: 'crt.connect',
    label: 'Connect UDEs into causal chains',
    hint: 'Read each edge aloud as "X exists, therefore Y exists." If it doesn\'t read true, restructure.',
  },
  {
    id: 'crt.deepen',
    label: 'Build down to root causes',
    hint: 'Keep asking "why does this happen?" until you hit a cause you actually control or influence.',
  },
  {
    id: 'crt.clr',
    label: 'Apply CLR challenges at every step',
    hint: 'Clarity → Existence → Sufficiency. Resolve each open warning or restructure the diagram.',
  },
  {
    id: 'crt.span',
    label: 'Test against your span of control / influence',
    hint: 'A root cause outside what you can affect is rarely the real root — keep digging.',
  },
  {
    id: 'crt.loops',
    label: 'Look for reinforcing loops',
    hint: 'Vicious circles explain why UDEs persist. Tag loop-closing edges as back-edges (right-click the edge).',
  },
  {
    id: 'crt.archive',
    label: "Archive rejected branches, don't delete them",
    hint: 'Move pruned alternatives into a group so the path-not-taken stays visible.',
  },
  {
    id: 'crt.core',
    label: 'Identify the Core Driver',
    hint: 'Run "Find core driver(s)" from the palette — the single cause whose elimination clears the most UDEs.',
  },
];

const FRT: MethodStep[] = [
  {
    id: 'frt.scope',
    label: 'Define the desired future state',
    hint: 'Use the System Scope section — what does success look like, measurably?',
  },
  {
    id: 'frt.injections',
    label: 'Choose your initial injections',
    hint: "The actions or conditions you'll introduce into the system. Start with one; add more as the tree demands.",
  },
  {
    id: 'frt.build',
    label: 'Build up causal chains to the Desired Effects',
    hint: 'Each edge should read "X exists, therefore Y exists" — the injections drive the desired effects via intermediate states.',
  },
  {
    id: 'frt.clr',
    label: 'Apply CLR challenges, especially predicted-effect existence',
    hint: 'Are the predicted intermediate effects realistic? Are sufficient conditions stated?',
  },
  {
    id: 'frt.negative',
    label: 'Watch for Negative Branches',
    hint: 'Each injection can spawn unintended UDEs. Capture them as a sub-tree and either mitigate or pick a different injection.',
  },
  {
    id: 'frt.reinforce',
    label: 'Design positive reinforcing loops',
    hint: 'Self-sustaining loops where success feeds itself. Tag the loop-closing edge as a back-edge to model it explicitly.',
  },
];

const PRT: MethodStep[] = [
  {
    id: 'prt.scope',
    label: 'State the ambitious objective',
    hint: 'Use the System Scope section — what would be a clearly bold but achievable target?',
  },
  {
    id: 'prt.obstacles',
    label: 'Identify the obstacles in the way',
    hint: "What's keeping you from the objective? Brainstorm freely; you'll prune later.",
  },
  {
    id: 'prt.io',
    label: 'For each obstacle, define an Intermediate Objective',
    hint: 'The condition that, once met, removes that obstacle. Pair them 1-to-1 if possible.',
  },
  {
    id: 'prt.sequence',
    label: 'Sequence the IOs',
    hint: 'Which IOs depend on others? PRT reads bottom-up — earliest prerequisites at the bottom.',
  },
  {
    id: 'prt.clr',
    label: 'Apply CLR challenges',
    hint: 'Especially entity-existence (is this really an obstacle?) and sufficiency (does meeting the IO actually remove it?).',
  },
  {
    id: 'prt.archive',
    label: 'Archive pruned alternatives',
    hint: "Don't delete considered-but-rejected IOs — group + collapse them so the rationale stays.",
  },
];

const TT: MethodStep[] = [
  {
    id: 'tt.scope',
    label: 'State the desired outcome',
    hint: "Use the System Scope section — what's the end state this plan produces?",
  },
  {
    id: 'tt.actions',
    label: 'List the actions required',
    hint: 'The do-something steps. Action-verb framing: "Audit X," "Draft Y," "Roll out Z."',
  },
  {
    id: 'tt.preconditions',
    label: 'Identify a precondition for each action',
    hint: "The existing reality that lets each action work. If you can't name it, use an Unspecified placeholder (EntityInspector checkbox) and come back.",
  },
  {
    id: 'tt.triples',
    label: 'Build the (Action + Precondition → Outcome) triples',
    hint: 'Each step is structurally complete when its outcome has BOTH an action and a non-action precondition feeding it.',
  },
  {
    id: 'tt.clr',
    label: 'Apply CLR challenges (including Complete-Step)',
    hint: 'The TT-specific Complete-Step rule fires on any action whose outcome lacks a precondition sibling.',
  },
  {
    id: 'tt.unspecified',
    label: 'Capture inarticulate reservations as Unspecified placeholders',
    hint: "When you sense something belongs but can't name it yet, add a placeholder Precondition and keep moving.",
  },
];

const EC: MethodStep[] = [
  {
    id: 'ec.conflict',
    label: 'State the recurring conflict in two sentences',
    hint: '"I want X, but I also want Y\'." Verbalize before drawing.',
  },
  {
    id: 'ec.goal',
    label: 'Articulate the common goal both sides serve',
    hint: 'The Goal box (leftmost) — what positive outcome both Wants are trying to produce.',
  },
  {
    id: 'ec.needs',
    label: 'Name both Needs',
    hint: 'Each Need is the prerequisite condition the corresponding Want is trying to satisfy.',
  },
  {
    id: 'ec.verbalize',
    label: 'Verbalize each edge as a necessary-condition statement',
    hint: '"In order to satisfy [Need], we must obtain [Want]" — read every edge aloud before continuing.',
  },
  {
    id: 'ec.assumptions',
    label: 'Brainstorm "…because" assumptions on each edge',
    hint: 'Every assumption should start with "…because" — the new-assumption input pre-fills the prefix on EC edges.',
  },
  {
    id: 'ec.clr',
    label: 'Apply CLR challenges on each assumption',
    hint: 'Especially clarity (is it stated as a fact rather than an opinion?) and existence (is it actually true here?).',
  },
  {
    id: 'ec.injection',
    label: 'Find an injection that breaks the conflict',
    hint: 'A condition that lets you have both Wants — or makes one Want unnecessary. Spawn a follow-up FRT to test it.',
  },
];

// FL-DT4 — Strategy & Tactics Tree. Goldratt's recipe for building an
// S&T cascade: anchor the apex strategy, articulate each layer's tactic
// + the three assumption facets (necessary / parallel / sufficiency),
// then recursively decompose. Six steps; matches the book's pacing.
const ST: MethodStep[] = [
  {
    id: 'st.apex',
    label: 'State the apex strategy',
    hint: 'The top-level objective the whole tree decomposes from — what does success at the highest level look like?',
  },
  {
    id: 'st.tactic',
    label: 'Name the tactic that achieves the strategy',
    hint: 'The "how" of the current layer. Action-verb framing: "Re-engineer X," "Establish Y," "Roll out Z."',
  },
  {
    id: 'st.na',
    label: 'List the Necessary Assumptions',
    hint: 'What must be true for the strategy itself to matter? If these fail, the strategy is irrelevant — not just unmet.',
  },
  {
    id: 'st.pa',
    label: 'List the Parallel Assumptions',
    hint: 'What must be true for THIS tactic to be the right approach? Alternatives might work if the parallel assumptions change.',
  },
  {
    id: 'st.sa',
    label: 'List the Sufficiency Assumptions',
    hint: 'What must be true for the tactic to actually achieve the strategy? These are the "expected effect" claims.',
  },
  {
    id: 'st.decompose',
    label: 'Decompose the tactic into child strategies',
    hint: "Each tactic becomes the strategy of the next layer down. Repeat until you've reached implementation-level granularity.",
  },
];

// FL-DT5 — Freeform diagrams have no canonical recipe. Empty checklist
// is intentional: the Document Inspector simply hides the section. If
// users later request a "general thinking-on-paper" checklist we can
// add one without a schema change.
const FREEFORM: MethodStep[] = [];

/**
 * Per-diagram-type canonical step list. Adding a new diagram type makes
 * TypeScript fail at compile time until a matching entry lands here — same
 * discipline as `DIAGRAM_TYPE_LABEL` and `EXAMPLE_BY_DIAGRAM`.
 */
export const METHOD_BY_DIAGRAM: Record<DiagramType, MethodStep[]> = {
  crt: CRT,
  frt: FRT,
  prt: PRT,
  tt: TT,
  ec: EC,
  st: ST,
  freeform: FREEFORM,
};

/**
 * Flat list of every known step id across all diagram types. Used by tests
 * to catch typos / duplicates in the catalog, and could surface in a future
 * import-validation pass to drop unknown checklist keys.
 */
export const ALL_METHOD_STEP_IDS: ReadonlySet<string> = new Set(
  Object.values(METHOD_BY_DIAGRAM).flatMap((steps) => steps.map((s) => s.id))
);
