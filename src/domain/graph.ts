// Pure graph queries over a TPDocument. No React, no store, no DOM —
// safe to use from validators, store actions, services, and tests.

import type { Edge, Entity, TPDocument } from './types';

export const incomingEdges = (doc: TPDocument, entityId: string): Edge[] =>
  Object.values(doc.edges).filter((e) => e.targetId === entityId);

export const outgoingEdges = (doc: TPDocument, entityId: string): Edge[] =>
  Object.values(doc.edges).filter((e) => e.sourceId === entityId);

export const connectionCount = (doc: TPDocument, entityId: string): number =>
  incomingEdges(doc, entityId).length + outgoingEdges(doc, entityId).length;

export const hasEdge = (doc: TPDocument, sourceId: string, targetId: string): boolean =>
  Object.values(doc.edges).some((e) => e.sourceId === sourceId && e.targetId === targetId);

export const isAssumption = (entity: Entity): boolean => entity.type === 'assumption';

export const structuralEntities = (doc: TPDocument): Entity[] =>
  Object.values(doc.entities).filter((e) => !isAssumption(e));

// Returns a new edges record with `entityId` cascaded out: edges that name it
// as source or target are dropped, and any remaining edge's assumptionIds is
// scrubbed of that id (collapsing the field when it would become empty).
export const removeEntityFromEdges = (doc: TPDocument, entityId: string): Record<string, Edge> => {
  const surviving = Object.values(doc.edges).filter(
    (e) => e.sourceId !== entityId && e.targetId !== entityId
  );
  const result: Record<string, Edge> = {};
  for (const edge of surviving) {
    if (!edge.assumptionIds?.includes(entityId)) {
      result[edge.id] = edge;
      continue;
    }
    const filtered = edge.assumptionIds.filter((a) => a !== entityId);
    result[edge.id] = { ...edge, assumptionIds: filtered.length ? filtered : undefined };
  }
  return result;
};
