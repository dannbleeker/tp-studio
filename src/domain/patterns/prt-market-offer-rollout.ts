import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Market-offer rollout (Prerequisite Tree). The implementation
 * half of Goldratt's *It's Not Luck* (1994), abstracted: an offer nobody
 * refuses still has to clear real obstacles — a price-trained sales
 * force, long-run production habits, sceptical first buyers, and
 * working-capital rules. Each obstacle gets one measurable intermediate
 * objective. Node text is original.
 */
export const buildPatternPRTMarketOfferRollout = (): TPDocument => {
  const t = Date.now();

  const goal = buildEntity(
    'goal',
    'The consumption-based offer is live with the top twenty accounts this year',
    t,
    1
  );

  const obsSales = buildEntity(
    'obstacle',
    'The sales force has only ever sold on unit price',
    t,
    2
  );
  const obsPlant = buildEntity(
    'obstacle',
    'The plant is tuned for long runs, not frequent small replenishment',
    t,
    3
  );
  const obsProof = buildEntity(
    'obstacle',
    "Prospects won't believe the promise until someone else has taken it",
    t,
    4
  );
  const obsCapital = buildEntity(
    'obstacle',
    'Working-capital rules block holding customer stock on our books',
    t,
    5
  );

  const ioSales = buildEntity(
    'intermediateObjective',
    'Retrain the senior reps to sell total supply cost, with one worked case per segment',
    t,
    6
  );
  const ioPlant = buildEntity(
    'intermediateObjective',
    'Cut changeover times on the constraint lines until weekly replenishment is routine',
    t,
    7
  );
  const ioProof = buildEntity(
    'intermediateObjective',
    'Sign two reference accounts on pilot terms and publish their measured results',
    t,
    8
  );
  const ioCapital = buildEntity(
    'intermediateObjective',
    'Agree a revised working-capital envelope with finance, tied to contracted consumption floors',
    t,
    9
  );

  const entities = [
    goal,
    obsSales,
    obsPlant,
    obsProof,
    obsCapital,
    ioSales,
    ioPlant,
    ioProof,
    ioCapital,
  ];
  const edges: Edge[] = [
    // Each IO overcomes its obstacle
    buildEdge(ioSales.id, obsSales.id, { kind: 'necessity' }),
    buildEdge(ioPlant.id, obsPlant.id, { kind: 'necessity' }),
    buildEdge(ioProof.id, obsProof.id, { kind: 'necessity' }),
    buildEdge(ioCapital.id, obsCapital.id, { kind: 'necessity' }),
    // Each obstacle blocks the goal
    buildEdge(obsSales.id, goal.id, { kind: 'necessity' }),
    buildEdge(obsPlant.id, goal.id, { kind: 'necessity' }),
    buildEdge(obsProof.id, goal.id, { kind: 'necessity' }),
    buildEdge(obsCapital.id, goal.id, { kind: 'necessity' }),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'prt',
    title: 'Market-offer rollout PRT',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 10,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 10,
  };
};
