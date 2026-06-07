import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * System archetype — "Eroding Goals" (Senge), as a CRT.
 *
 * A gap between goal and performance creates pressure; instead of lifting
 * performance, the goal is lowered to close the gap — so the standard drifts
 * down and the gap reopens at a lower bar. Each pass lowers the goal further: a
 * **reinforcing** (R) downward ratchet, closed by the `isBackEdge` arc back to
 * the gap. Break it by holding the goal and improving performance (the hint).
 */
export const buildPatternCRTErodingGoals = (): TPDocument => {
  const t = Date.now();

  const gap = buildEntity('rootCause', 'A gap opens between the goal and actual performance', t, 1);
  const pressure = buildEntity('effect', 'Pressure builds to close the gap', t, 2);
  const lower = buildEntity('effect', 'We lower the goal instead of lifting performance', t, 3);
  const drift = buildEntity(
    'ude',
    'The standard drifts down; the gap reopens at a lower bar',
    t,
    4
  );

  const entities = [gap, pressure, lower, drift];
  const edges: Edge[] = [
    buildEdge(gap.id, pressure.id),
    buildEdge(pressure.id, lower.id),
    buildEdge(lower.id, drift.id),
    // Loop arc — the lower standard reopens the gap, ratcheting down each pass.
    { ...buildEdge(drift.id, gap.id), isBackEdge: true },
  ];

  return {
    id: newDocumentId(),
    diagramType: 'crt',
    title: 'Eroding Goals (system archetype)',
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
