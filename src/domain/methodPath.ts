import type { Messages } from '@/i18n/types';
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
  /**
   * Catalogue key for the call-to-action, keyed by the diagram you are coming
   * FROM. The prompt itself lives in `en.nextStep`; this module stays
   * locale-free so it can be called from anywhere.
   */
  labelKey: keyof Messages['nextStep'];
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
        ? { diagram: 'ec', labelKey: 'crt' }
        : null;
    case 'ec':
      return entitiesOfType(doc, 'want').length > 0 ? { diagram: 'frt', labelKey: 'ec' } : null;
    case 'frt':
      return entitiesOfType(doc, 'injection').length > 0
        ? { diagram: 'prt', labelKey: 'frt' }
        : null;
    case 'prt':
      return entitiesOfType(doc, 'intermediateObjective').length > 0
        ? { diagram: 'tt', labelKey: 'prt' }
        : null;
    default:
      return null;
  }
};
