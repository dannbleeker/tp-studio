import { isOfBuiltin } from '../entityTypeMeta';
import { incomingEdges, outgoingEdges } from '../graph';
import type { TPDocument } from '../types';
import { makeWarning, type UntieredWarning } from './shared';

/**
 * Cause-effect reversal CLR rule. Detects two structural anti-patterns
 * that almost always indicate the user wired an edge backward:
 *
 *   - A **Root Cause** with incoming edges (root causes are by definition
 *     terminal causes — nothing feeds into them).
 *   - A **UDE** with outgoing edges (UDEs are terminal effects — nothing
 *     follows from them downstream).
 *
 * The warning targets the entity, not the edge, because the diagnosis is
 * "this entity's role is mis-assigned" — fix is usually to convert the
 * entity's type OR reverse the offending edge(s) via the reverse-edge
 * command.
 */
export const causeEffectReversalRule = (doc: TPDocument): UntieredWarning[] => {
  const out: UntieredWarning[] = [];
  // B3: `isOfBuiltin` lets custom classes participate. A user-defined
  // class with `supersetOf: 'rootCause'` or `'ude'` is treated as
  // structurally the same for this rule.
  for (const e of Object.values(doc.entities)) {
    if (
      isOfBuiltin(e.type, 'rootCause', doc.customEntityClasses) &&
      incomingEdges(doc, e.id).length > 0
    ) {
      out.push(
        makeWarning(
          doc,
          'cause-effect-reversal',
          { kind: 'entity', id: e.id },
          'A Root Cause should not have incoming causes. Check the arrow: does that cause make this happen, or is it just how you know this is here? If the latter, the arrow is reversed.'
        )
      );
    }
    if (
      isOfBuiltin(e.type, 'ude', doc.customEntityClasses) &&
      outgoingEdges(doc, e.id).length > 0
    ) {
      out.push(
        makeWarning(
          doc,
          'cause-effect-reversal',
          { kind: 'entity', id: e.id },
          'A UDE should not have outgoing effects. Check the arrow: does this make the effect happen, or is the effect just how you know this UDE is here? If the latter, the arrow is reversed.'
        )
      );
    }
  }
  return out;
};
