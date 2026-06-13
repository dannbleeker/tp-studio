import { entitiesOfType } from './graph';
import type { DiagramType, TPDocument } from './types';

/**
 * The canonical Theory-of-Constraints Thinking-Process sequence — the linear
 * "current reality → conflict → future → implementation" spine that the method
 * walks. Goal Tree / S&T are *parallel* planning tracks (a branch), not steps in
 * this line, so they live in {@link TP_GOAL_BRANCH}. NBR / freeform are ad-hoc
 * and don't belong to the spine at all.
 */
export const TP_METHOD_SEQUENCE: DiagramType[] = ['crt', 'ec', 'frt', 'prt', 'tt'];

/** Parallel planning track, shown as a branch off the main sequence. */
export const TP_GOAL_BRANCH: DiagramType[] = ['goalTree', 'st'];

export type NextStep = {
  /** The diagram to create / open next. */
  diagram: DiagramType;
  /** Short call-to-action shown in the stepper. */
  label: string;
};

/**
 * Contextual "what's the next move" suggestion, based on where the active doc
 * sits in the method AND whether it has reached a milestone that makes the next
 * step meaningful (e.g. a CRT only suggests an Evaporating Cloud once a root
 * cause exists). Returns `null` when there's no clear next step, so the stepper
 * shows a suggestion only when it's genuinely earned — never nags.
 */
export const nextStepFor = (doc: TPDocument): NextStep | null => {
  switch (doc.diagramType) {
    case 'crt':
      return entitiesOfType(doc, 'rootCause').length > 0
        ? { diagram: 'ec', label: 'Root cause found — break it with an Evaporating Cloud' }
        : null;
    case 'ec':
      return entitiesOfType(doc, 'want').length > 0
        ? {
            diagram: 'frt',
            label: 'Conflict mapped — design the breakthrough in a Future Reality Tree',
          }
        : null;
    case 'frt':
      return entitiesOfType(doc, 'injection').length > 0
        ? {
            diagram: 'prt',
            label: 'Injection in place — plan the rollout with a Prerequisite Tree',
          }
        : null;
    case 'prt':
      return entitiesOfType(doc, 'intermediateObjective').length > 0
        ? { diagram: 'tt', label: 'Objectives set — sequence the steps in a Transition Tree' }
        : null;
    default:
      return null;
  }
};
