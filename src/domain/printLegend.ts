import type { DiagramType } from './types';

/**
 * Per-diagram-type "how to read this" legend (Session 178) — a one-line
 * reading rule printed on the page when the Print dialog's "how-to-read
 * legend" toggle is on, so a shared printout is self-explanatory to a reader
 * unfamiliar with that Thinking Process. Returns `''` for freeform, which has
 * no fixed reading rule (and so prints no legend).
 */

const TYPE_LABEL: Record<DiagramType, string> = {
  crt: 'Current Reality Tree',
  frt: 'Future Reality Tree',
  prt: 'Prerequisite Tree',
  tt: 'Transition Tree',
  ec: 'Evaporating Cloud',
  goalTree: 'Goal Tree',
  st: 'Strategy & Tactics Tree',
  nbr: 'Negative Branch Reservation',
  freeform: 'Diagram',
};

const READING_RULE: Record<DiagramType, string> = {
  crt: 'Read bottom-up — each arrow means "because (the cause below), therefore (the effect above)." Root causes sit at the base; the core driver is the root cause that feeds the most undesirable effects.',
  frt: 'Read bottom-up from the injections (what you will do) up to the desired effects. An undesirable effect marks a negative branch — a risk the plan should suppress with a further injection.',
  prt: 'Read top-down — the injection at the top needs every Intermediate Objective beneath it, and each objective overcomes a named obstacle. The lowest objectives are done first.',
  tt: 'Read bottom-up — each step pairs an action with the need it meets and the effect it produces, in sequence from the first action up to the goal.',
  ec: 'Read it as two requirements in tension: "in order to [the objective] we must [B]" along one arm and "we must [C]" along the other — but the needs beneath B and C conflict. The resolution is to break an assumption on one of the arrows.',
  goalTree:
    'Read top-down — "in order to [the Goal] we must satisfy [each Critical Success Factor]; in order to each CSF we must meet [its Necessary Conditions]." Goal at the top, CSFs in the middle, NCs at the base.',
  st: 'Each node carries five facets — Necessary Assumption (why act now), Strategy (the outcome), Parallel Assumption (why this approach), Tactic (what we will do), Sufficiency Assumption (why the tactic is enough). Read top-down, parent strategy to child strategies.',
  nbr: 'Read bottom-up from the injection — trace forward to the undesirable effect it might also cause, through the turning point, to the mitigation that keeps the branch from following.',
  freeform: '',
};

/** The full legend line for a diagram type, or `''` when there's no reading rule. */
export function printLegendFor(diagramType: DiagramType): string {
  const rule = READING_RULE[diagramType];
  if (!rule) return '';
  return `How to read this ${TYPE_LABEL[diagramType]}: ${rule}`;
}
