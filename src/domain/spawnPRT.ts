import { incomingEdges } from './graph';
import { newDocumentId, newEdgeId, newEntityId } from './ids';
import type { Edge, Entity, TPDocument } from './types';

/**
 * Spawn a Prerequisite Tree from an Interference Diagram — the structural half
 * of the book's "ID/IO Simplified Strategy" (Sproull & Nelson, *Epiphanized*,
 * App. 4). An ID already carries the PRT triple, just laid out radially: the
 * central objective is the PRT's apex goal, each interference is an obstacle,
 * and each interference's paired injection is the Intermediate Objective that
 * overcomes it. So this is a faithful re-layout — radial → dependency tree —
 * that preserves the edges as PRT `IO → obstacle → goal`.
 *
 * Pure + UNLINKED (matches `spawnFRTFromCrt` / `spawnCRTFromGoalTree`): reads the
 * source, returns a brand-new document with fresh ids, never mutates the ID. The
 * caller routes the result through `openDocInTab`.
 */
export const spawnPRTFromID = (sourceDoc: TPDocument): TPDocument => {
  const t = Date.now();
  const interferences = Object.values(sourceDoc.entities).filter((e) => e.type === 'obstacle');
  const sourceGoal = Object.values(sourceDoc.entities).find((e) => e.type === 'goal');

  let ann = 0;
  const entities: Entity[] = [];
  const edges: Edge[] = [];

  // Apex goal — carry the ID's central objective, or synthesize one.
  ann += 1;
  const goalId = newEntityId();
  entities.push({
    id: goalId,
    type: 'goal',
    title: sourceGoal?.title.trim() || 'Objective',
    annotationNumber: ann,
    createdAt: t,
    updatedAt: t,
    position: { x: 400, y: 40 },
  });

  interferences.forEach((interference, i) => {
    // The interference becomes a PRT obstacle blocking the goal.
    ann += 1;
    const obstacleId = newEntityId();
    entities.push({
      id: obstacleId,
      type: 'obstacle',
      title: interference.title.trim() || 'Obstacle',
      annotationNumber: ann,
      createdAt: t,
      updatedAt: t,
      position: { x: 120 + i * 260, y: 260 },
    });
    edges.push({ id: newEdgeId(), sourceId: obstacleId, targetId: goalId, kind: 'sufficiency' });

    // Its paired injection (an incoming IO edge on the ID) becomes the
    // Intermediate Objective; synthesize a placeholder title when unpaired.
    const pairedIo = incomingEdges(sourceDoc, interference.id)
      .map((e) => sourceDoc.entities[e.sourceId])
      .find((src) => src?.type === 'intermediateObjective');
    ann += 1;
    const ioId = newEntityId();
    entities.push({
      id: ioId,
      type: 'intermediateObjective',
      title:
        pairedIo?.title.trim() || `Overcome: ${interference.title.trim() || 'the interference'}`,
      annotationNumber: ann,
      createdAt: t,
      updatedAt: t,
      position: { x: 120 + i * 260, y: 460 },
    });
    edges.push({ id: newEdgeId(), sourceId: ioId, targetId: obstacleId, kind: 'sufficiency' });
  });

  const titlePrefix = (sourceDoc.title || 'Interference Diagram').slice(0, 40);
  return {
    id: newDocumentId(),
    diagramType: 'prt',
    title: `PRT from "${titlePrefix}"`,
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: ann + 1,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 10,
  };
};
