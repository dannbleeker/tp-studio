import { isOfBuiltin } from '../entityTypeMeta';
import { outgoingEdges } from '../graph';
import type { TPDocument } from '../types';
import { type UntieredWarning, makeWarning } from './shared';

/**
 * Predicted-effect existence CLR rule (FRT-specific). When the user adds
 * an injection but hasn't yet captured what *else* follows from it, the
 * rule prompts them to think through downstream effects. Once at least
 * one outgoing edge exists, the rule stays silent — the user has at
 * least started the trace.
 */
export const predictedEffectExistenceRule = (doc: TPDocument): UntieredWarning[] => {
  const out: UntieredWarning[] = [];
  for (const e of Object.values(doc.entities)) {
    // B3: custom classes with supersetOf='injection' participate.
    if (
      isOfBuiltin(e.type, 'injection', doc.customEntityClasses) &&
      outgoingEdges(doc, e.id).length === 0
    ) {
      out.push(
        makeWarning(
          doc,
          'predicted-effect-existence',
          { kind: 'entity', id: e.id },
          'If this injection holds, what other effects follow? None captured yet.'
        )
      );
    }
  }
  return out;
};
