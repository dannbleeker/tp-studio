/**
 * Pattern library — curated starter diagrams for common TOC scenarios.
 *
 * Session 134: closes minor gap #4 (sub-item A) from the spec gap
 * analysis. Each `Pattern` is a fully-formed `TPDocument` factory the
 * "Pattern library…" picker can drop onto the canvas as a starting
 * point. Distinct from `EXAMPLE_BY_DIAGRAM` (one example per diagram
 * type, kept for the quick "Load example" command); patterns are
 * many-per-type and surface in a dedicated library dialog.
 *
 * The library is intentionally curated, not generated: each pattern
 * should be a teaching-quality starting point that a TOC practitioner
 * would recognise as a canonical shape. Toy data dilutes the value.
 *
 * Growing the library: add a builder file alongside this one (one
 * per pattern), then register it in `PATTERNS` below. The registry
 * is a flat array because patterns aren't keyed on diagram type
 * alone — multiple patterns share a `diagramType` and the dialog
 * needs the per-pattern label / hint to differentiate them.
 */
import { buildExampleCRT } from '../examples/crt';
import { buildExampleEC } from '../examples/ec';
import { buildExampleFRT } from '../examples/frt';
import { buildExampleGoalTree } from '../examples/goalTree';
import { buildExampleNBR } from '../examples/nbr';
import { buildExamplePRT } from '../examples/prt';
import { buildExampleST } from '../examples/st';
import { buildExampleTT } from '../examples/tt';
import type { DiagramType, TPDocument } from '../types';
import { buildPatternCRTEngineeringVelocity } from './crt-engineering-velocity';
import { buildPatternECQualityVsSpeed } from './ec-quality-vs-speed';

export type Pattern = {
  /** Stable id used by tests + as the dialog list key. */
  id: string;
  /** Card title in the library dialog. */
  label: string;
  /** One-line description of what the pattern models — surfaces in the
   *  card hint below the label. */
  hint: string;
  /** Drives the diagram-type filter pill and the chip on each card. */
  diagramType: DiagramType;
  /** Mints a fresh `TPDocument`. Called when the user picks the card.
   *  Same shape as `EXAMPLE_BY_DIAGRAM[type]()`. */
  build: () => TPDocument;
};

export const PATTERNS: Pattern[] = [
  // ── CRT ────────────────────────────────────────────────────────────
  {
    id: 'crt-customer-satisfaction',
    label: 'Customer satisfaction declining',
    hint: 'Classic operational CRT — fulfilment-flow root causes feeding a single customer UDE, with one AND junctor.',
    diagramType: 'crt',
    build: buildExampleCRT,
  },
  {
    id: 'crt-engineering-velocity',
    label: 'Engineering velocity decline',
    hint: 'Software team CRT — sprint slip rolls up from on-call / review / flake causes, with an AND on the ops-drag effect.',
    diagramType: 'crt',
    build: buildPatternCRTEngineeringVelocity,
  },

  // ── EC ─────────────────────────────────────────────────────────────
  {
    id: 'ec-work-life-balance',
    label: 'Work / life balance',
    hint: 'Teaching-classic personal EC — "leave at 5" vs "stay late", with the explicit D↔D′ mutex arrow.',
    diagramType: 'ec',
    build: buildExampleEC,
  },
  {
    id: 'ec-quality-vs-speed',
    label: 'Quality vs speed',
    hint: 'Engineering tradeoff EC — QA gate vs continuous delivery, both routes to "ship features customers love".',
    diagramType: 'ec',
    build: buildPatternECQualityVsSpeed,
  },

  // ── FRT ────────────────────────────────────────────────────────────
  {
    id: 'frt-default',
    label: 'Future Reality Tree starter',
    hint: 'Bottom-up FRT seeded with an injection — propagates through intermediate effects to a desired effect.',
    diagramType: 'frt',
    build: buildExampleFRT,
  },

  // ── PRT ────────────────────────────────────────────────────────────
  {
    id: 'prt-default',
    label: 'Prerequisite Tree starter',
    hint: 'Necessity-style PRT — objective at top, obstacles beneath, intermediate objectives clearing each.',
    diagramType: 'prt',
    build: buildExamplePRT,
  },

  // ── TT ─────────────────────────────────────────────────────────────
  {
    id: 'tt-support-triage',
    label: 'Support triage Transition Tree',
    hint: 'Canonical Outcome ← (Precondition + Action) triples joined by AND junctors, including one unspecified precondition.',
    diagramType: 'tt',
    build: buildExampleTT,
  },

  // ── NBR ────────────────────────────────────────────────────────────
  {
    id: 'nbr-qa-gate',
    label: 'QA gate Negative Branch Reservation',
    hint: 'Software-team NBR — QA-gate injection spawns slower releases + lost competitive edge; proactive mitigation swaps to test-suite hardening.',
    diagramType: 'nbr',
    build: buildExampleNBR,
  },

  // ── Goal Tree ─────────────────────────────────────────────────────
  {
    id: 'goalTree-default',
    label: 'Goal Tree starter',
    hint: '3-layer necessity tree — Goal at top, Critical Success Factors beneath, Necessary Conditions feeding each CSF.',
    diagramType: 'goalTree',
    build: buildExampleGoalTree,
  },

  // ── S&T ───────────────────────────────────────────────────────────
  {
    id: 'st-default',
    label: 'Strategy & Tactics starter',
    hint: 'Hierarchical S&T — strategy / tactic pairs with rationale fields (necessary / parallel / sufficient assumptions).',
    diagramType: 'st',
    build: buildExampleST,
  },
];

/** Subset of `PATTERNS` matching the given diagram type, in registry order. */
export const patternsForDiagram = (diagramType: DiagramType): Pattern[] =>
  PATTERNS.filter((p) => p.diagramType === diagramType);

/** Lookup by stable id; `undefined` if the id isn't in the registry. */
export const patternById = (id: string): Pattern | undefined => PATTERNS.find((p) => p.id === id);
