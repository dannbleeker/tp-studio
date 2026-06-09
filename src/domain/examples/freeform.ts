import { newDocumentId, newEntityId } from '../ids';
import type { Assumption, Edge, TPDocument } from '../types';
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
  const note = buildEntity(
    'note',
    'Re-run cohort analysis after the Q4 product changes ship',
    t,
    5
  );

  const entities = [claim, evidence1, evidence2, note];
  const edges: Edge[] = [buildEdge(evidence1.id, claim.id), buildEdge(evidence2.id, claim.id)];
  // Record-canonical: the caveat is an edge ANNOTATION (a doc.assumptions record
  // keyed to the edge via `edgeId`), not an entity. It annotates evidence-2 → claim.
  const evidence2Edge = edges[1]!;
  const caveatId = newEntityId();
  const assumptions: Record<string, Assumption> = {
    [caveatId]: {
      id: caveatId,
      edgeId: evidence2Edge.id,
      text: 'Sample size for NPS is small (n=240); margin of error ±6',
      status: 'unexamined',
      annotationNumber: 4,
      createdAt: t,
      updatedAt: t,
    },
  };

  return {
    id: newDocumentId(),
    diagramType: 'freeform',
    title: 'Retention argument',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 6,
    assumptions,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 10,
  };
};
