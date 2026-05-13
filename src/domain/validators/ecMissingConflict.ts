import { isOfBuiltin } from '../entityTypeMeta';
import type { TPDocument } from '../types';
import { type UntieredWarning, makeWarning } from './shared';

/**
 * EC-specific CLR rule (TOC-reading): an Evaporating Cloud's diagnostic
 * value comes from the conflict between two Wants — the book has the user
 * explicitly mark the conflict via an edge between the two `want` entities
 * (in Flying Logic, a negative-weight edge; in TP Studio, an edge with
 * `isMutualExclusion: true`).
 *
 * Fires once on an EC document when:
 *   - There are at least two `want`-typed entities, AND
 *   - No edge between two `want` entities has `isMutualExclusion: true`.
 *
 * The warning targets the document's first Want (deterministically — by
 * annotation number) since there's no specific "conflict edge" to point at
 * yet. Resolving the warning is a user action: draw the edge between the
 * two Wants and tick the Mutual exclusion checkbox in the Edge Inspector.
 *
 * Tier: `existence` — the question "is this really a conflict?" is a
 * structural-existence check, not a clarity or sufficiency one.
 */
export const ecMissingConflictRule = (doc: TPDocument): UntieredWarning[] => {
  // B3: include custom classes with `supersetOf: 'want'`.
  const wants = Object.values(doc.entities).filter((e) =>
    isOfBuiltin(e.type, 'want', doc.customEntityClasses)
  );
  if (wants.length < 2) return [];

  const wantIds = new Set(wants.map((w) => w.id));
  const hasMutex = Object.values(doc.edges).some(
    (e) => e.isMutualExclusion === true && wantIds.has(e.sourceId) && wantIds.has(e.targetId)
  );
  if (hasMutex) return [];

  // Point at the lowest-numbered Want so the warning has a concrete target.
  const target = wants.sort((a, b) => a.annotationNumber - b.annotationNumber)[0];
  if (!target) return [];

  return [
    makeWarning(
      doc,
      'ec-missing-conflict',
      { kind: 'entity', id: target.id },
      'No mutual-exclusion edge between the two Wants — is this really a conflict?'
    ),
  ];
};
