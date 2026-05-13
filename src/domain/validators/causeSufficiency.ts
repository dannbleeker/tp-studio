import { incomingEdges, structuralEntities } from '../graph';
import type { TPDocument } from '../types';
import { type UntieredWarning, makeWarning } from './shared';

/**
 * Cause-sufficiency CLR rule. When a structural entity has exactly one
 * incoming edge AND that edge isn't part of an AND group, prompt the user
 * to reflect on whether a single cause is really sufficient or whether
 * they should AND-group it with another. Multiple incoming edges or an
 * existing AND group both indicate the user has already addressed
 * sufficiency, so we stay silent.
 */
export const causeSufficiencyRule = (doc: TPDocument): UntieredWarning[] => {
  const out: UntieredWarning[] = [];
  for (const e of structuralEntities(doc)) {
    const incoming = incomingEdges(doc, e.id);
    const single = incoming[0];
    if (incoming.length === 1 && single && !single.andGroupId) {
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
