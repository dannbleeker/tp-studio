import { displayTitle } from '../entityPalettes';
import { entitiesOfType, incomingEdges } from '../graph';
import type { TPDocument } from '../types';
import { makeWarning, type UntieredWarning } from './shared';

/**
 * Session 179 (Theme B) — a UDE with no cause feeding it.
 *
 * A CRT is structurally incomplete while a UDE sits with no incoming causal
 * edge: it's a list item, not yet woven into the tree. More precise than the
 * generic entity-existence check, which only flags fully-disconnected entities
 * (a UDE drawn as a cause — with outgoing but no incoming edges — slips past
 * that check but is caught here). Scoped to CRT.
 */
export const crtUdeNoUpstreamRule = (doc: TPDocument): UntieredWarning[] => {
  if (doc.diagramType !== 'crt') return [];
  const out: UntieredWarning[] = [];
  for (const ude of entitiesOfType(doc, 'ude')) {
    if (incomingEdges(doc, ude.id).length === 0) {
      out.push(
        makeWarning(
          doc,
          'crt-ude-no-upstream',
          { kind: 'entity', id: ude.id },
          `UDE "${displayTitle(ude)}" has no cause feeding it — the tree is incomplete until it connects to the causal chain.`
        )
      );
    }
  }
  return out;
};
