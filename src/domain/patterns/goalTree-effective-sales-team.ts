import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Effective sales team (Goal Tree).
 *
 * A go-to-market Goal Tree for running a sales team that hits the
 * number predictably. The Goal is unsentimental — a forecast that
 * comes within 10% of plan, three quarters in a row — and the CSFs
 * cover the three structural conditions for predictability: a
 * qualified pipeline, sales-ready product, and a coachable rep
 * population.
 *
 * Each Necessary Condition is observable on a Monday morning: a
 * dashboard you can pull up, a number you can ask for in a stand-
 * up. The pattern stays away from CSFs like "great culture" or
 * "strong product-market fit" — those are real but unfalsifiable
 * inside a Goal Tree.
 */
export const buildPatternGoalTreeEffectiveSalesTeam = (): TPDocument => {
  const t = Date.now();

  const goal = buildEntity(
    'goal',
    'Run a sales team whose forecast lands within 10% of plan three quarters in a row',
    t,
    1
  );

  const csf1 = buildEntity(
    'criticalSuccessFactor',
    'Pipeline coverage is real, not theatrical',
    t,
    2
  );
  const csf2 = buildEntity(
    'criticalSuccessFactor',
    'Reps are equipped with current product knowledge and proof points',
    t,
    3
  );
  const csf3 = buildEntity(
    'criticalSuccessFactor',
    'Manager 1:1s improve rep performance quarter-over-quarter',
    t,
    4
  );

  const nc1 = buildEntity(
    'necessaryCondition',
    'Pipeline coverage stands at ≥3× quarterly target on day one of the quarter',
    t,
    5
  );
  const nc2 = buildEntity(
    'necessaryCondition',
    'Each pipeline opportunity has a written next step within the last seven days',
    t,
    6
  );
  const nc3 = buildEntity(
    'necessaryCondition',
    'Every rep can run a 20-minute discovery call without slides',
    t,
    7
  );
  const nc4 = buildEntity(
    'necessaryCondition',
    'Two named, public-by-permission customer references per industry vertical',
    t,
    8
  );
  const nc5 = buildEntity(
    'necessaryCondition',
    'Average rep ramp-to-quota stays under five months',
    t,
    9
  );

  const entities = [goal, csf1, csf2, csf3, nc1, nc2, nc3, nc4, nc5];
  const edges: Edge[] = [
    buildEdge(csf1.id, goal.id, { kind: 'necessity' }),
    buildEdge(csf2.id, goal.id, { kind: 'necessity' }),
    buildEdge(csf3.id, goal.id, { kind: 'necessity' }),
    buildEdge(nc1.id, csf1.id, { kind: 'necessity' }),
    buildEdge(nc2.id, csf1.id, { kind: 'necessity' }),
    buildEdge(nc3.id, csf2.id, { kind: 'necessity' }),
    buildEdge(nc4.id, csf2.id, { kind: 'necessity' }),
    buildEdge(nc5.id, csf3.id, { kind: 'necessity' }),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'goalTree',
    title: 'Effective sales team Goal Tree',
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
