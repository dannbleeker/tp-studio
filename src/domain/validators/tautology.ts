import { SIMILARITY_THRESHOLD } from '../constants';
import { outgoingEdges, structuralEntities } from '../graph';
import type { TPDocument } from '../types';
import { type UntieredWarning, makeWarning, similarity } from './shared';

/**
 * Tautology CLR rule. When a structural entity has exactly one outgoing
 * edge and the child's title is very similar (≥ `SIMILARITY_THRESHOLD`)
 * to the parent's, the link is probably restating the same fact rather
 * than capturing a real cause/effect step. Multiple outgoing edges
 * dilute the signal, so we only check single-child cases.
 */
export const tautologyRule = (doc: TPDocument): UntieredWarning[] => {
  const out: UntieredWarning[] = [];
  for (const e of structuralEntities(doc)) {
    const outgoing = outgoingEdges(doc, e.id);
    const sole = outgoing[0];
    if (outgoing.length !== 1 || !sole) continue;
    const child = doc.entities[sole.targetId];
    if (!child) continue;
    if (similarity(e.title, child.title) >= SIMILARITY_THRESHOLD) {
      out.push(
        makeWarning(
          doc,
          'tautology',
          { kind: 'entity', id: e.id },
          'This statement is nearly identical to its effect — possible tautology.'
        )
      );
    }
  }
  return out;
};
