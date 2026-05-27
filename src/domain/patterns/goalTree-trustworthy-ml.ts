import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Trustworthy ML system (Goal Tree).
 *
 * A Goal Tree for running an ML / AI system that the org and its
 * customers can rely on. The Goal is concrete ("the model serves
 * production traffic without surprise regressions") and the three
 * CSFs cover the three dimensions that practically determine trust:
 * what the model claims, how it claims it, and what happens when
 * the claim is wrong.
 *
 * The Necessary Conditions are observable practices, not aspirational
 * commitments. Useful as a template because most ML Goal Trees
 * conflate model quality (an offline metric) with system quality
 * (everything that happens around the model in production).
 */
export const buildPatternGoalTreeTrustworthyMl = (): TPDocument => {
  const t = Date.now();

  const goal = buildEntity(
    'goal',
    'Run an ML system the org and its customers can rely on in production',
    t,
    1
  );

  const csf1 = buildEntity(
    'criticalSuccessFactor',
    'Model claims are honest about scope and uncertainty',
    t,
    2
  );
  const csf2 = buildEntity(
    'criticalSuccessFactor',
    'Production performance matches offline evaluation',
    t,
    3
  );
  const csf3 = buildEntity(
    'criticalSuccessFactor',
    'Failures are detectable and recoverable without on-call heroics',
    t,
    4
  );

  const nc1 = buildEntity(
    'necessaryCondition',
    'Every released model carries an updated model card listing its scope and known failure modes',
    t,
    5
  );
  const nc2 = buildEntity(
    'necessaryCondition',
    'Predictions in the user-facing product carry calibrated confidence scores',
    t,
    6
  );
  const nc3 = buildEntity(
    'necessaryCondition',
    'Online evaluation tracks the same metrics that gated the offline release',
    t,
    7
  );
  const nc4 = buildEntity(
    'necessaryCondition',
    'A shadow model runs in parallel for two weeks before any release flips traffic',
    t,
    8
  );
  const nc5 = buildEntity(
    'necessaryCondition',
    'An automated rollback path returns to the previous model within five minutes of a degradation alert',
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
    title: 'Trustworthy ML system Goal Tree',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 10,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 8,
  };
};
