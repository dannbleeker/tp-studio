import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Alcohol-ban rollout (Prerequisite Tree).
 *
 * The implementation PRT from Mabin & Cavana's New Zealand case (System
 * Dynamics Review 40(4), 2024), paraphrased and lightly condensed (the
 * paper works seven obstacles; two lobbying obstacles and two education
 * IOs are merged here for canvas readability): legislation, shopper
 * convenience, retail resistance, public attitudes, and visitor awareness
 * each get an intermediate objective. Node text is an original paraphrase
 * of the paper's Table 4.
 */
export const buildPatternPRTAlcoholBanRollout = (): TPDocument => {
  const t = Date.now();

  const goal = buildEntity(
    'goal',
    'Alcohol is out of supermarkets, sold from separate nearby stores',
    t,
    1
  );

  const obsLaw = buildEntity('obstacle', 'Current law lets supermarkets sell alcohol', t, 2);
  const obsConvenience = buildEntity(
    'obstacle',
    'Shoppers prize the convenience of buying alcohol with the groceries',
    t,
    3
  );
  const obsResistance = buildEntity(
    'obstacle',
    'Supermarkets lean on alcohol for profit and will resist the change',
    t,
    4
  );
  const obsAttitudes = buildEntity(
    'obstacle',
    'Many customers see no problem with regular drinking',
    t,
    5
  );
  const obsVisitors = buildEntity(
    'obstacle',
    'Visitors act on outdated information about the rules',
    t,
    6
  );

  const ioLaw = buildEntity('intermediateObjective', 'Parliament amends the licensing law', t, 7);
  const ioConvenience = buildEntity(
    'intermediateObjective',
    'Retailers make the separate store quick to reach from the supermarket',
    t,
    8
  );
  const ioResistance = buildEntity(
    'intermediateObjective',
    'Pricing absorbs the separate-store cost while public campaigns press the industry on social responsibility',
    t,
    9
  );
  const ioAttitudes = buildEntity(
    'intermediateObjective',
    'Public-health education on harm and safer habits, backed by better addiction services',
    t,
    10
  );
  const ioVisitors = buildEntity(
    'intermediateObjective',
    'Clear notices at airports and borders explain the current law',
    t,
    11
  );

  const entities = [
    goal,
    obsLaw,
    obsConvenience,
    obsResistance,
    obsAttitudes,
    obsVisitors,
    ioLaw,
    ioConvenience,
    ioResistance,
    ioAttitudes,
    ioVisitors,
  ];
  const edges: Edge[] = [
    // Each intermediate objective overcomes its obstacle
    buildEdge(ioLaw.id, obsLaw.id, { kind: 'necessity' }),
    buildEdge(ioConvenience.id, obsConvenience.id, { kind: 'necessity' }),
    buildEdge(ioResistance.id, obsResistance.id, { kind: 'necessity' }),
    buildEdge(ioAttitudes.id, obsAttitudes.id, { kind: 'necessity' }),
    buildEdge(ioVisitors.id, obsVisitors.id, { kind: 'necessity' }),
    // Each obstacle blocks the goal
    buildEdge(obsLaw.id, goal.id, { kind: 'necessity' }),
    buildEdge(obsConvenience.id, goal.id, { kind: 'necessity' }),
    buildEdge(obsResistance.id, goal.id, { kind: 'necessity' }),
    buildEdge(obsAttitudes.id, goal.id, { kind: 'necessity' }),
    buildEdge(obsVisitors.id, goal.id, { kind: 'necessity' }),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'prt',
    title: 'Alcohol-ban rollout PRT',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 12,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 10,
  };
};
