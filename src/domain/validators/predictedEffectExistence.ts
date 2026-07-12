import { isOfBuiltin } from '../entityTypeMeta';
import { outgoingEdges } from '../graph';
import type { TPDocument } from '../types';
import { makeWarning, type UntieredWarning } from './shared';

/**
 * Predicted-effect existence CLR rule (FRT-specific). When the user adds
 * an injection but hasn't yet captured what *else* follows from it, the
 * rule prompts them to name a collateral effect it must also produce — one
 * they can then go and check for in reality (its absence challenges the
 * injection). Once at least one outgoing edge exists, the rule stays silent —
 * the user has at least started the trace. The companion *timing*
 * counter-example (an effect that appears before its cause can't be caused by
 * it) has no structural signal, so it lives as a per-edge scrutiny question in
 * `clrScrutiny.ts` rather than an always-on warning.
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
          'If this injection holds, name one other effect it must also produce — then you can go and check for it. None captured yet.'
        )
      );
    }
  }
  return out;
};
