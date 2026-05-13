import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';
import { buildEdge, buildEntity } from './shared';

/**
 * Example freeform diagram (FL-DT5): a small argument-mapping sketch.
 * Demonstrates that the freeform mode renders the same primitives as
 * the TOC diagrams but without the type-pattern-matching CLR rules
 * firing — the diagram is purely structural.
 */
export const buildExampleFreeform = (): TPDocument => {
  const t = Date.now();

  const claim = buildEntity('effect', 'Our product retains users better than competitors', t, 1);
  const evidence1 = buildEntity('effect', 'Q3 cohort 90-day retention: 78%', t, 2);
  const evidence2 = buildEntity('effect', 'Net promoter score: 62 (industry avg: 38)', t, 3);
  const caveat = buildEntity(
    'assumption',
    'Sample size for NPS is small (n=240); margin of error ±6',
    t,
    4
  );
  const note = buildEntity(
    'note',
    'Re-run cohort analysis after the Q4 product changes ship',
    t,
    5
  );

  const entities = [claim, evidence1, evidence2, caveat, note];
  const edges: Edge[] = [buildEdge(evidence1.id, claim.id), buildEdge(evidence2.id, claim.id)];
  // Caveat attaches to the evidence-2 edge as an assumption.
  const evidence2Edge = edges[1]!;
  edges[1] = { ...evidence2Edge, assumptionIds: [caveat.id] };

  return {
    id: newDocumentId(),
    diagramType: 'freeform',
    title: 'Retention argument (example freeform diagram)',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 6,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 6,
  };
};
