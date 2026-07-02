import { incomingEdges, junctorGroupId, structuralEntities } from '../graph';
import type { TPDocument } from '../types';
import { makeWarning, type UntieredWarning } from './shared';

/**
 * Cause-sufficiency CLR rule. When a structural entity has exactly one
 * incoming edge AND that edge isn't part of any junctor group, prompt the user
 * to reflect on whether a single cause is really sufficient or whether
 * they should AND-group it with another. Multiple incoming edges or an
 * existing junctor group both indicate the user has already addressed
 * sufficiency, so we stay silent. (Checks all junctor kinds, not just AND, for
 * parity with `indirect-effect`.)
 */
export const causeSufficiencyRule = (doc: TPDocument): UntieredWarning[] => {
  const out: UntieredWarning[] = [];
  for (const e of structuralEntities(doc)) {
    const incoming = incomingEdges(doc, e.id);
    const single = incoming[0];
    if (incoming.length === 1 && single && !junctorGroupId(single)) {
      out.push(
        makeWarning(
          doc,
          'cause-sufficiency',
          { kind: 'edge', id: single.id },
          'Is this cause alone enough? Consider grouping with another as an AND.'
        )
      );
    }
  }
  return out;
};
