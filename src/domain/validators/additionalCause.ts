import { entitiesOfBuiltin, incomingEdges } from '../graph';
import type { EntityType, TPDocument } from '../types';
import { makeWarning, type UntieredWarning, type ValidatorRule } from './shared';

/**
 * Additional-cause CLR rule, parametrized by the diagram's "terminal-effect"
 * entity type(s). For a CRT this is `ude` (Undesirable Effect), for an FRT
 * it's `desiredEffect`, and an NBR carries BOTH (the intended FRT half plus
 * the negative branch's UDEs). PRT and TT have no analogous terminal-cause
 * concept so the rule simply isn't registered for them.
 *
 * Terminal matching goes through `entitiesOfBuiltin`, so custom entity
 * classes with a matching `supersetOf` get the nudge too — consistent with
 * the other `isOfBuiltin`-aware rules. The signature requires at least one
 * type (`first`), so a registry edit can't accidentally produce a silently
 * dead zero-type rule.
 *
 * Returns a `ValidatorRule` (not a warning array directly) so the per-diagram
 * registry in `index.ts` can pre-bind the terminal type(s) per diagram.
 */
export const additionalCauseRuleFor = (first: EntityType, ...rest: EntityType[]): ValidatorRule => {
  const terminalTypes = [first, ...rest];
  return (doc: TPDocument): UntieredWarning[] => {
    const out: UntieredWarning[] = [];
    // A custom class has exactly one `supersetOf` and the builtin types are
    // distinct, so an entity can match at most one terminal type — no dedup
    // needed across the loop.
    for (const t of terminalTypes) {
      for (const e of entitiesOfBuiltin(doc, t)) {
        if (incomingEdges(doc, e.id).length === 0) {
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
    }
    return out;
  };
};
