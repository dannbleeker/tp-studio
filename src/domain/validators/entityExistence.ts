import { DISCONNECTED_GRAPH_FLOOR } from '../constants';
import { incomingEdges, isNonCausal, outgoingEdges } from '../graph';
import type { TPDocument } from '../types';
import { type UntieredWarning, makeWarning } from './shared';

/**
 * Entity-existence CLR rule. Two failure modes:
 *
 *   - **Empty title** — an entity with no text fails the "entity existence"
 *     check directly; you can't reason about a placeholder.
 *   - **Disconnected** — only checked when the graph has more than
 *     `DISCONNECTED_GRAPH_FLOOR` total entities. Below the floor we assume
 *     the user is mid-sketch and noise would dominate; above it, an
 *     entity with no edges is either forgotten or an orphan from a
 *     deletion. Non-causal entities (assumptions attach to edges via
 *     `edge.assumptionIds`; notes are free-form annotations that never
 *     belong to the causal graph) are exempt.
 *
 * Entities flagged `unspecified: true` are exempt from the empty-title
 * check — they exist *deliberately* as placeholders that the user hasn't
 * articulated yet (TOC-reading: "unspecified Preconditions in a TT").
 */
export const entityExistenceRule = (doc: TPDocument): UntieredWarning[] => {
  const out: UntieredWarning[] = [];
  const entities = Object.values(doc.entities);
  const total = entities.length;
  for (const e of entities) {
    if (e.title.trim() === '' && e.unspecified !== true) {
      out.push(
        makeWarning(doc, 'entity-existence', { kind: 'entity', id: e.id }, 'Entity has no title.')
      );
      continue;
    }
    if (total > DISCONNECTED_GRAPH_FLOOR && !isNonCausal(e)) {
      const incoming = incomingEdges(doc, e.id).length;
      const outgoing = outgoingEdges(doc, e.id).length;
      if (incoming + outgoing === 0) {
        out.push(
          makeWarning(
            doc,
            'entity-existence',
            { kind: 'entity', id: e.id },
            'Entity is disconnected from the graph.'
          )
        );
      }
    }
  }
  return out;
};
