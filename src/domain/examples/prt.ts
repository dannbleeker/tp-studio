import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';
import { buildEdge, buildEntity } from './shared';

/**
 * Example Prerequisite Tree. Goal at the apex, obstacles in the middle,
 * intermediate objectives at the bottom. Read bottom-up: do these IOs →
 * defeat these obstacles → reach goal.
 */
export const buildExamplePRT = (): TPDocument => {
  const t = Date.now();

  const goal = buildEntity('goal', 'Launch the new product line in Q3', t, 1);

  const obsTraining = buildEntity('obstacle', 'Engineering lacks the new tech stack', t, 2);
  const obsBudget = buildEntity('obstacle', 'No purchasing approval for the toolchain', t, 3);
  const obsStaffing = buildEntity('obstacle', 'QA team is at capacity', t, 4);

  const ioTraining = buildEntity(
    'intermediateObjective',
    'Run a two-week training sprint with paired exercises',
    t,
    5
  );
  const ioBudget = buildEntity(
    'intermediateObjective',
    'Submit a budget request with vendor quotes to leadership',
    t,
    6
  );
  const ioQA = buildEntity(
    'intermediateObjective',
    'Hire two contract testers for the launch window',
    t,
    7
  );

  const entities = [goal, obsTraining, obsBudget, obsStaffing, ioTraining, ioBudget, ioQA];
  const edges: Edge[] = [
    // IOs overcome the obstacles directly above them.
    buildEdge(ioTraining.id, obsTraining.id),
    buildEdge(ioBudget.id, obsBudget.id),
    buildEdge(ioQA.id, obsStaffing.id),
    // Each defeated obstacle unblocks the apex goal.
    buildEdge(obsTraining.id, goal.id),
    buildEdge(obsBudget.id, goal.id),
    buildEdge(obsStaffing.id, goal.id),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'prt',
    title: 'Product-launch Prerequisite Tree',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 8,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 8,
  };
};
