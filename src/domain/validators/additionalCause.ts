import { incomingEdges } from '../graph';
import type { EntityType, TPDocument } from '../types';
import { type UntieredWarning, type ValidatorRule, makeWarning } from './shared';

/**
 * Additional-cause CLR rule, parametrized by the diagram's "terminal-effect"
 * entity type. For a CRT this is `ude` (Undesirable Effect), for an FRT
 * it's `desiredEffect`. PRT and TT have no analogous terminal-cause concept
 * so the rule simply isn't registered for them.
 *
 * Returns a `ValidatorRule` (not a warning array directly) so the per-diagram
 * registry in `index.ts` can pre-bind the terminal type per diagram.
 */
export const additionalCauseRuleFor =
  (terminalType: EntityType): ValidatorRule =>
  (doc: TPDocument): UntieredWarning[] => {
    const out: UntieredWarning[] = [];
    for (const e of Object.values(doc.entities)) {
      if (e.type === terminalType && incomingEdges(doc, e.id).length === 0) {
        out.push(
          makeWarning(
            doc,
            'additional-cause',
            { kind: 'entity', id: e.id },
            'No causes captured. Are there causes you haven’t added?'
          )
        );
      }
    }
    return out;
  };
