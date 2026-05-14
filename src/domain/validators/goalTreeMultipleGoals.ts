import type { TPDocument } from '../types';
import { type UntieredWarning, makeWarning } from './shared';

/**
 * Session 79 — Goal Tree multi-goal soft warning.
 *
 * Dettmer's Intermediate Objectives Map prescribes a single apex
 * Goal entity with 3-5 Critical Success Factors below. When a Goal
 * Tree document carries more than one `goal` entity, fire a soft
 * `clarity`-tier warning so the user sees the divergence without
 * being blocked.
 *
 * The warning carries an optional one-click `action` (handled via
 * the `WARNING_ACTIONS` registry in the store layer) that converts
 * every extra `goal` to `criticalSuccessFactor`. Sorting is by
 * `createdAt` then `id` — the oldest goal stays apex, everything
 * else demotes. Users who want multiple goals can dismiss the
 * warning via the existing Resolved toggle and continue.
 */
export const goalTreeMultipleGoalsRule = (doc: TPDocument): UntieredWarning[] => {
  if (doc.diagramType !== 'goalTree') return [];
  const goals = Object.values(doc.entities).filter((e) => e.type === 'goal');
  if (goals.length <= 1) return [];
  // Warning anchors on the oldest goal — sorted by annotationNumber
  // because two entities created in the same tick share createdAt and
  // would otherwise tiebreak on random ids.
  const apex = goals.slice().sort((a, b) => a.annotationNumber - b.annotationNumber)[0];
  if (!apex) return [];
  return [
    {
      ...makeWarning(
        doc,
        'goalTree-multiple-goals',
        { kind: 'entity', id: apex.id },
        `Goal Tree has ${goals.length} goals — Dettmer's pattern is a single apex Goal with 3-5 CSFs below.`
      ),
      action: {
        actionId: 'convert-extra-goals-to-csfs',
        label: 'Convert extras to CSFs',
      },
    },
  ];
};
