import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * System archetype — "Escalation" (Senge), as a CRT.
 *
 * Two parties each react to the other: A acts to get ahead, B feels threatened
 * and responds in kind, which threatens A again — a **reinforcing** (R) arms
 * race. The `isBackEdge` arc closes the loop from the mutual-threat effect back
 * to A's action; all edges positive → R. Break it by changing the measure both
 * sides are reacting to (the hint).
 */
export const buildPatternCRTEscalation = (): TPDocument => {
  const t = Date.now();

  const aActs = buildEntity('rootCause', 'Party A acts to get ahead', t, 1);
  const bResponds = buildEntity('effect', 'Party B feels threatened and responds in kind', t, 2);
  const threat = buildEntity(
    'ude',
    "Each side's response threatens the other, driving more action",
    t,
    3
  );

  const entities = [aActs, bResponds, threat];
  const edges: Edge[] = [
    buildEdge(aActs.id, bResponds.id),
    buildEdge(bResponds.id, threat.id),
    // Loop arc — the mutual threat drives A to act again. Reinforcing.
    { ...buildEdge(threat.id, aActs.id), isBackEdge: true },
  ];

  return {
    id: newDocumentId(),
    diagramType: 'crt',
    title: 'Escalation (system archetype)',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 4,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 9,
  };
};
