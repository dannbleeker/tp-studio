import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * System archetype — "Shifting the Burden" (Senge), as a CRT.
 *
 * A symptom can be met with a symptomatic quick fix or a fundamental solution.
 * Leaning on the quick fix grows reliance and lets the fundamental capability
 * atrophy, so the underlying problem is never resolved and recurs — a
 * **reinforcing** (R) dependency spiral, closed by the `isBackEdge` arc back to
 * the symptom. Break it by investing in the fundamental solution despite the
 * symptom (the hint).
 */
export const buildPatternCRTShiftingTheBurden = (): TPDocument => {
  const t = Date.now();

  const symptom = buildEntity(
    'rootCause',
    'An underlying problem produces a visible symptom',
    t,
    1
  );
  const quickFix = buildEntity('effect', 'We apply the symptomatic quick fix', t, 2);
  const atrophy = buildEntity(
    'effect',
    'Reliance on the quick fix grows; the fundamental capability atrophies',
    t,
    3
  );
  const persists = buildEntity('ude', 'The underlying problem is never resolved and recurs', t, 4);

  const entities = [symptom, quickFix, atrophy, persists];
  const edges: Edge[] = [
    buildEdge(symptom.id, quickFix.id),
    buildEdge(quickFix.id, atrophy.id),
    buildEdge(atrophy.id, persists.id),
    // Loop arc — the unresolved problem keeps producing the symptom. Reinforcing.
    { ...buildEdge(persists.id, symptom.id), isBackEdge: true },
  ];

  return {
    id: newDocumentId(),
    diagramType: 'crt',
    title: 'Shifting the Burden (system archetype)',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 5,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 9,
  };
};
