import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Alcohol policy (Goal Tree).
 *
 * A Goal Tree for the New Zealand alcohol-policy case, paraphrased after
 * the framing in Mabin & Cavana (System Dynamics Review 40(4), 2024):
 * national wellbeing at the apex — high enough to include the health
 * system, the retailers, and everyday people — with harm reduction, a
 * viable retail economy, and public acceptance as the showstopper CSFs.
 *
 * The paper presents its own Goal Tree (its Figure 9); this pattern
 * paraphrases the case's framing rather than reproducing that figure.
 * Node text is original.
 */
export const buildPatternGoalTreeAlcoholPolicy = (): TPDocument => {
  const t = Date.now();

  const goal = buildEntity(
    'goal',
    "Alcohol policy that improves the nation's wellbeing now and long-term",
    t,
    1
  );

  const csfHarm = buildEntity(
    'criticalSuccessFactor',
    'Alcohol-related harm falls measurably',
    t,
    2
  );
  const csfEconomy = buildEntity(
    'criticalSuccessFactor',
    'The retail and hospitality economy stays viable',
    t,
    3
  );
  const csfPublic = buildEntity(
    'criticalSuccessFactor',
    'The public accepts and follows the policy',
    t,
    4
  );

  const ncDrinking = buildEntity(
    'necessaryCondition',
    'Heavy and underage drinking decline year on year',
    t,
    5
  );
  const ncServices = buildEntity(
    'necessaryCondition',
    'Addiction and support services reach the people who need them',
    t,
    6
  );
  const ncRoute = buildEntity(
    'necessaryCondition',
    'Retailers keep a lawful, workable route to sell alcohol',
    t,
    7
  );
  const ncEvidence = buildEntity(
    'necessaryCondition',
    'The public understands the harm evidence behind the rules',
    t,
    8
  );
  const ncEnforce = buildEntity(
    'necessaryCondition',
    'Rules are enforced consistently enough to be credible',
    t,
    9
  );

  const entities = [
    goal,
    csfHarm,
    csfEconomy,
    csfPublic,
    ncDrinking,
    ncServices,
    ncRoute,
    ncEvidence,
    ncEnforce,
  ];
  const edges: Edge[] = [
    // CSFs → Goal
    buildEdge(csfHarm.id, goal.id, { kind: 'necessity' }),
    buildEdge(csfEconomy.id, goal.id, { kind: 'necessity' }),
    buildEdge(csfPublic.id, goal.id, { kind: 'necessity' }),
    // NCs → harm-reduction CSF
    buildEdge(ncDrinking.id, csfHarm.id, { kind: 'necessity' }),
    buildEdge(ncServices.id, csfHarm.id, { kind: 'necessity' }),
    // NC → retail-economy CSF
    buildEdge(ncRoute.id, csfEconomy.id, { kind: 'necessity' }),
    // NCs → public-acceptance CSF
    buildEdge(ncEvidence.id, csfPublic.id, { kind: 'necessity' }),
    buildEdge(ncEnforce.id, csfPublic.id, { kind: 'necessity' }),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'goalTree',
    title: 'Alcohol-policy Goal Tree',
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
