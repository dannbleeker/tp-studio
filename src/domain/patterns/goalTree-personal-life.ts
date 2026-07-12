import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Personal Life Goal Tree.
 *
 * The "life goals and supporting objectives" model from the *TOC Handbook*
 * (Ch. 38, "TOC for Personal Productivity/Dilemmas", Cox & Schleier),
 * abstracted: a satisfying life decomposes into a handful of make-or-break
 * facets — health and growth, close relationships, friends and community,
 * work, and professional development — each with the conditions that keep it
 * healthy. The chapter suggests reviewing the leaves on a daily / weekly /
 * monthly cadence; a facet that keeps getting stuck is a candidate for its own
 * conflict cloud. Node text is original.
 */
export const buildPatternGoalTreePersonalLife = (): TPDocument => {
  const t = Date.now();

  const goal = buildEntity('goal', 'Live a satisfying, well-rounded life', t, 1);

  const csfPersonal = buildEntity(
    'criticalSuccessFactor',
    'I look after my own health and growth',
    t,
    2
  );
  const csfFamily = buildEntity('criticalSuccessFactor', 'My close relationships are strong', t, 3);
  const csfCommunity = buildEntity(
    'criticalSuccessFactor',
    'I give to friends and community',
    t,
    4
  );
  const csfWork = buildEntity('criticalSuccessFactor', 'My work is going well', t, 5);
  const csfProfessional = buildEntity(
    'criticalSuccessFactor',
    'I keep growing professionally',
    t,
    6
  );

  const ncHealth = buildEntity(
    'necessaryCondition',
    'I keep up regular exercise, rest, and the things that recharge me',
    t,
    7
  );
  const ncPresent = buildEntity(
    'necessaryCondition',
    "I'm genuinely present for the people closest to me",
    t,
    8
  );
  const ncCommunity = buildEntity(
    'necessaryCondition',
    'I give time to friends and a cause I care about',
    t,
    9
  );
  const ncDeliver = buildEntity(
    'necessaryCondition',
    'I deliver what my role needs, at a sustainable pace',
    t,
    10
  );
  const ncLearn = buildEntity(
    'necessaryCondition',
    'I keep learning the skills my field is moving toward',
    t,
    11
  );

  const entities = [
    goal,
    csfPersonal,
    csfFamily,
    csfCommunity,
    csfWork,
    csfProfessional,
    ncHealth,
    ncPresent,
    ncCommunity,
    ncDeliver,
    ncLearn,
  ];
  const edges: Edge[] = [
    // Each facet is necessary for a well-rounded life.
    buildEdge(csfPersonal.id, goal.id, { kind: 'necessity' }),
    buildEdge(csfFamily.id, goal.id, { kind: 'necessity' }),
    buildEdge(csfCommunity.id, goal.id, { kind: 'necessity' }),
    buildEdge(csfWork.id, goal.id, { kind: 'necessity' }),
    buildEdge(csfProfessional.id, goal.id, { kind: 'necessity' }),
    // One necessary condition beneath each facet.
    buildEdge(ncHealth.id, csfPersonal.id, { kind: 'necessity' }),
    buildEdge(ncPresent.id, csfFamily.id, { kind: 'necessity' }),
    buildEdge(ncCommunity.id, csfCommunity.id, { kind: 'necessity' }),
    buildEdge(ncDeliver.id, csfWork.id, { kind: 'necessity' }),
    buildEdge(ncLearn.id, csfProfessional.id, { kind: 'necessity' }),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'goalTree',
    title: 'Personal Life Goal Tree',
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
