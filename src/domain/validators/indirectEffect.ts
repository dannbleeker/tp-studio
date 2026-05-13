import { incomingEdges, structuralEntities } from '../graph';
import type { TPDocument } from '../types';
import { type UntieredWarning, makeWarning } from './shared';

/**
 * Indirect-effect CLR rule (E2 — Bucket E extension). When a structural
 * entity has three or more *direct* incoming edges that are NOT part of
 * any AND group, prompt the user to consider whether some of those direct
 * causes should chain through an intermediate effect instead. Three is
 * the threshold rather than two because two-cause shapes are common,
 * intentional, and don't typically need an intermediate — three is where
 * "wait, are some of these really chaining through a step I haven't
 * drawn?" starts to feel motivated.
 *
 * AND-grouped edges are exempt: an explicit AND group already signals
 * "these causes ARE meant to converge directly." Once the user has made
 * that commitment, prompting about indirect effects would just be noise.
 *
 * Skips assumption entities (those attach to edges, not graph entities).
 * Targets the entity itself, not any specific edge — the rule's question
 * is about the entity's overall causal shape.
 */
const INDIRECT_EFFECT_THRESHOLD = 3;

export const indirectEffectRule = (doc: TPDocument): UntieredWarning[] => {
  const out: UntieredWarning[] = [];
  for (const e of structuralEntities(doc)) {
    const incoming = incomingEdges(doc, e.id);
    const ungrouped = incoming.filter((edge) => !edge.andGroupId);
    if (ungrouped.length >= INDIRECT_EFFECT_THRESHOLD) {
      out.push(
        makeWarning(
          doc,
          'indirect-effect',
          { kind: 'entity', id: e.id },
          `${ungrouped.length} direct causes — could some chain through intermediate effects?`
        )
      );
    }
  }
  return out;
};
