import type { TPDocument } from '../types';
import { type UntieredWarning, makeWarning } from './shared';

/**
 * Causality-existence CLR rule — one warning per edge prompting the user to
 * justify the link ("Does the cause inevitably produce the effect?"). This
 * isn't a structural defect detector; it's a deliberate per-edge nudge that
 * the user resolves manually via the inspector's warning list. Resolved
 * warnings stay resolved across re-validation thanks to the stable id +
 * `resolvedWarnings` map.
 */
export const causalityExistenceRule = (doc: TPDocument): UntieredWarning[] =>
  Object.values(doc.edges).map((edge) =>
    makeWarning(
      doc,
      'causality-existence',
      { kind: 'edge', id: edge.id },
      'Does the cause inevitably produce the effect?'
    )
  );
