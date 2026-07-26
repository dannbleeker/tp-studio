import { en } from '@/i18n/locales/en';
import type { Messages } from '@/i18n/types';
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
 * silently ignored on read. Changing an id is a breaking change that drops
 * the existing checkmark; treat ids as part of the JSON wire format.
 *
 * Session 209 — the labels and hints moved to the message catalogue
 * (`src/i18n/locales/en.ts`, under `method`), keyed by those same step ids.
 * Because the id was ALREADY the wire-format key, there is no second key to
 * keep in sync. This file keeps what is structure rather than copy: which
 * steps exist and in what order.
 *
 * Labels and hints are kept concise; the checklist is meant to be glanceable
 * in the Document Inspector dialog, not a full method tutorial.
 */

export type MethodStep = {
  id: string;
  label: string;
  hint?: string;
};

const CRT: readonly string[] = [
  'crt.scope',
  'crt.udes',
  'crt.connect',
  'crt.deepen',
  'crt.clr',
  'crt.span',
  'crt.loops',
  'crt.archive',
  'crt.core',
];

const FRT: readonly string[] = [
  'frt.scope',
  'frt.injections',
  'frt.build',
  'frt.clr',
  'frt.negative',
  'frt.reinforce',
];

const PRT: readonly string[] = [
  'prt.scope',
  'prt.obstacles',
  'prt.io',
  'prt.sequence',
  'prt.clr',
  'prt.archive',
];

const TT: readonly string[] = [
  'tt.scope',
  'tt.actions',
  'tt.preconditions',
  'tt.triples',
  'tt.appropriate-condition',
  'tt.clr',
  'tt.unspecified',
];

const EC: readonly string[] = [
  'ec.conflict',
  'ec.goal',
  'ec.needs',
  'ec.syntax',
  'ec.verbalize',
  'ec.jeopardy',
  'ec.assumptions',
  'ec.clr',
  'ec.injection',
];

const ST: readonly string[] = [
  'st.analysis-first',
  'st.apex',
  'st.tactic',
  'st.na',
  'st.pa',
  'st.sa',
  'st.decompose',
];

const FREEFORM: readonly string[] = [];

const NBR: readonly string[] = [
  'nbr.injection',
  'nbr.forward',
  'nbr.turning-point',
  'nbr.udes',
  'nbr.mitigation',
  'nbr.clr',
  'nbr.decision',
];

const GOAL_TREE: readonly string[] = [
  'goalTree.system',
  'goalTree.goal',
  'goalTree.csfs',
  'goalTree.ncs',
  'goalTree.verify',
  'goalTree.gaps',
  'goalTree.scrutiny',
];

const ID: readonly string[] = [
  'id.objective',
  'id.interferences',
  'id.quantify',
  'id.injections',
  'id.act',
];

/** Step ids per diagram type, in presentation order. Structure, not copy. */
const IDS_BY_DIAGRAM: Record<DiagramType, readonly string[]> = {
  crt: CRT,
  frt: FRT,
  prt: PRT,
  tt: TT,
  ec: EC,
  st: ST,
  id: ID,
  freeform: FREEFORM,
  goalTree: GOAL_TREE,
  nbr: NBR,
};

/**
 * Resolve a diagram's checklist against a locale catalogue.
 *
 * React callers should pass `useT()` so the checklist follows the active
 * language. An id with no catalogue entry is skipped rather than rendered as
 * a raw key — a partially-translated locale should show fewer steps, never
 * `crt.scope` as a label.
 */
export const methodStepsFor = (messages: Messages, diagramType: DiagramType): MethodStep[] => {
  const ids = IDS_BY_DIAGRAM[diagramType] ?? [];
  const out: MethodStep[] = [];
  for (const id of ids) {
    const copy = messages.method[id as keyof Messages['method']];
    if (!copy) continue;
    out.push({ id, label: copy.label, ...('hint' in copy ? { hint: copy.hint } : {}) });
  }
  return out;
};

/**
 * English view of the checklist, for callers outside a React render (the
 * PPTX and reasoning exporters) and for tests. Same fallback contract as
 * `Warning.message`: real copy, always available, just not locale-aware.
 */
export const METHOD_BY_DIAGRAM: Record<DiagramType, MethodStep[]> = {
  crt: methodStepsFor(en, 'crt'),
  frt: methodStepsFor(en, 'frt'),
  prt: methodStepsFor(en, 'prt'),
  tt: methodStepsFor(en, 'tt'),
  ec: methodStepsFor(en, 'ec'),
  st: methodStepsFor(en, 'st'),
  id: methodStepsFor(en, 'id'),
  freeform: methodStepsFor(en, 'freeform'),
  goalTree: methodStepsFor(en, 'goalTree'),
  nbr: methodStepsFor(en, 'nbr'),
};

/**
 * Flat list of every known step id across all diagram types. Used by tests
 * to catch typos / duplicates in the catalog, and could surface in a future
 * import-validation pass to drop unknown checklist keys.
 *
 * Built from the id table rather than from `METHOD_BY_DIAGRAM` so it stays
 * complete even if a catalogue entry is missing.
 */
export const ALL_METHOD_STEP_IDS: ReadonlySet<string> = new Set(
  Object.values(IDS_BY_DIAGRAM).flat()
);
