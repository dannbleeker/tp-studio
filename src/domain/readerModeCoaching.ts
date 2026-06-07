import type { EdgeKind, EntityType } from './types';

/**
 * Session 180 / E6 — Reader / Trainee mode coaching copy.
 *
 * Per-element explanations shown as tooltip cards when the user hovers
 * an entity or edge in Reader mode. The goal is to let a non-expert read
 * a shared TP diagram without prior training: they can hover any element
 * and understand what it represents in Theory of Constraints terms.
 *
 * Two registries:
 *   `ENTITY_TYPE_COACHING` — covers all 15 built-in entity types.
 *   `EDGE_KIND_COACHING`   — covers both edge kinds (sufficiency / necessity).
 *
 * Custom entity classes are not in this registry; `EntityCoachingTooltip`
 * falls back to the type label alone when no entry is found.
 *
 * Coaching copy is deliberately concise (≤ 2 sentences). The goal is
 * orientation, not a tutorial. The full book chapter is always reachable
 * via the ? Help button.
 */

export interface CoachingEntry {
  /** Short noun-phrase label shown in bold above the tip. */
  label: string;
  /** 1–2 sentence coaching text. */
  tip: string;
}

export const ENTITY_TYPE_COACHING: Record<EntityType, CoachingEntry> = {
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
  assumption: {
    label: 'Assumption',
    tip: 'An unverified claim the arrow depends on. Surfacing assumptions is where real scrutiny happens — the weakest one is where resistance will come from.',
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
    tip: "In an Evaporating Cloud, a Need is what each Want is trying to satisfy. The tension lives in the needs, not the wants themselves.",
  },
  want: {
    label: 'Want',
    tip: 'One of the two conflicting requirements in the Evaporating Cloud. The cloud dissolves when you find the assumption behind one of the necessity arrows.',
  },
  note: {
    label: 'Note',
    tip: 'A free-floating annotation. Notes sit outside the logical graph and do not affect causality or necessity chains.',
  },
};

export const EDGE_KIND_COACHING: Record<EdgeKind, CoachingEntry> = {
  sufficiency: {
    label: 'Sufficiency arrow (→)',
    tip: 'Read: "If (cause), then (effect)." The cause is sufficient to produce the effect. To challenge: is the cause really sufficient, or is something else also needed?',
  },
  necessity: {
    label: 'Necessity arrow (←)',
    tip: 'Read: "In order to (parent), we must (child)." The child is required — without it the parent cannot be achieved. To challenge: is this truly necessary, or is there another way?',
  },
};
