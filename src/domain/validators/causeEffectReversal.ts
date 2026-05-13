import { isOfBuiltin } from '../entityTypeMeta';
import { incomingEdges, outgoingEdges } from '../graph';
import type { TPDocument } from '../types';
import { type UntieredWarning, makeWarning } from './shared';

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
          'A Root Cause should not have incoming causes — possible cause/effect reversal.'
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
          'A UDE should not have outgoing effects — possible cause/effect reversal.'
        )
      );
    }
  }
  return out;
};
