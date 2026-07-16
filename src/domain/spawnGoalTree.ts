import { newDocumentId, newEdgeId, newEntityId } from './ids';
import type { Edge, Entity, TPDocument } from './types';

/**
 * Spawn a Goal Tree (Dettmer's Intermediate Objectives Map) from an Interference
 * Diagram — the strategy half of the book's "ID/IO Simplified Strategy"
 * (Sproull & Nelson, *Epiphanized*, App. 4). Where the ID surfaced the
 * interferences and a fix for each, the IO map arranges those fixes into the
 * necessity structure that reaches the objective.
 *
 * Mapping: the ID's central objective becomes the Goal; each intermediate
 * objective becomes a Critical Success Factor beneath it (the tier directly
 * below the Goal in an IO map). The user then decomposes each CSF into Necessary
 * Conditions — exactly the next step the Goal-Tree "CSF has no NCs" nudge
 * prompts. Edges read `CSF → goal` (necessity: "in order to <goal> we must <CSF>").
 *
 * Pure + UNLINKED (matches `spawnFRTFromCrt` / `spawnCRTFromGoalTree`).
 */
export const spawnGoalTreeFromID = (sourceDoc: TPDocument): TPDocument => {
  const t = Date.now();
  const ios = Object.values(sourceDoc.entities).filter((e) => e.type === 'intermediateObjective');
  const sourceGoal = Object.values(sourceDoc.entities).find((e) => e.type === 'goal');

  let ann = 0;
  const entities: Entity[] = [];
  const edges: Edge[] = [];

  ann += 1;
  const goalId = newEntityId();
  entities.push({
    id: goalId,
    type: 'goal',
    title: sourceGoal?.title.trim() || 'Goal',
    annotationNumber: ann,
    createdAt: t,
    updatedAt: t,
    position: { x: 400, y: 40 },
  });

  ios.forEach((io, i) => {
    ann += 1;
    const csfId = newEntityId();
    entities.push({
      id: csfId,
      type: 'criticalSuccessFactor',
      title: io.title.trim() || 'Critical success factor',
      annotationNumber: ann,
      createdAt: t,
      updatedAt: t,
      position: { x: 120 + i * 260, y: 260 },
    });
    edges.push({ id: newEdgeId(), sourceId: csfId, targetId: goalId, kind: 'necessity' });
  });

  const titlePrefix = (sourceDoc.title || 'Interference Diagram').slice(0, 40);
  return {
    id: newDocumentId(),
    diagramType: 'goalTree',
    title: `Goal Tree from "${titlePrefix}"`,
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
