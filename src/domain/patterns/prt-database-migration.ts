import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Database migration (Prerequisite Tree).
 *
 * The canonical technical-migration PRT: an objective at the apex
 * ("move the orders database from MySQL to Postgres without
 * downtime"), four real obstacles a migration team will recognise,
 * and a paired intermediate objective for each that clears the
 * obstacle directly. Bigger than the default PRT (more obstacles)
 * so it reads as a realistic project plan rather than a teaching
 * toy.
 *
 * The IO writing matters: each IO is *the action that clears the
 * obstacle*, not "we know about this obstacle" — Dettmer's
 * recurring complaint about novice PRTs is that they list
 * obstacles and then put the same obstacles in different words on
 * the IO row, which leaves the plan empty of actual work.
 */
export const buildPatternPRTDatabaseMigration = (): TPDocument => {
  const t = Date.now();

  const goal = buildEntity(
    'goal',
    'Move the orders database from MySQL to Postgres with zero customer-visible downtime',
    t,
    1
  );

  const obsSchema = buildEntity(
    'obstacle',
    'Live schema diverged from the documented one over five years of patches',
    t,
    2
  );
  const obsBackpressure = buildEntity(
    'obstacle',
    'Application code assumes MySQL-specific case-folding on the customer_id column',
    t,
    3
  );
  const obsCutover = buildEntity(
    'obstacle',
    'Order writes peak at 8× the read load during Black Friday',
    t,
    4
  );
  const obsRollback = buildEntity(
    'obstacle',
    'Rolling back after partial cutover would corrupt orders mid-flight',
    t,
    5
  );

  const ioSchema = buildEntity(
    'intermediateObjective',
    'Reconstruct the live schema from production and pin it in version control',
    t,
    6
  );
  const ioCaseFolding = buildEntity(
    'intermediateObjective',
    'Add an application-layer case-folding wrapper and remove every direct query',
    t,
    7
  );
  const ioPeakLoad = buildEntity(
    'intermediateObjective',
    'Run dual-write at full peak load on a Monday before the seasonal freeze',
    t,
    8
  );
  const ioRollback = buildEntity(
    'intermediateObjective',
    'Implement a single-source-of-truth flag the orders service flips at cutover',
    t,
    9
  );

  const entities = [
    goal,
    obsSchema,
    obsBackpressure,
    obsCutover,
    obsRollback,
    ioSchema,
    ioCaseFolding,
    ioPeakLoad,
    ioRollback,
  ];
  // Necessity edges read child → parent. IOs clear the obstacle above
  // them; cleared obstacles unblock the goal at the apex.
  const edges: Edge[] = [
    buildEdge(ioSchema.id, obsSchema.id, { kind: 'necessity' }),
    buildEdge(ioCaseFolding.id, obsBackpressure.id, { kind: 'necessity' }),
    buildEdge(ioPeakLoad.id, obsCutover.id, { kind: 'necessity' }),
    buildEdge(ioRollback.id, obsRollback.id, { kind: 'necessity' }),
    buildEdge(obsSchema.id, goal.id, { kind: 'necessity' }),
    buildEdge(obsBackpressure.id, goal.id, { kind: 'necessity' }),
    buildEdge(obsCutover.id, goal.id, { kind: 'necessity' }),
    buildEdge(obsRollback.id, goal.id, { kind: 'necessity' }),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'prt',
    title: 'Database migration PRT',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 10,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 9,
  };
};
