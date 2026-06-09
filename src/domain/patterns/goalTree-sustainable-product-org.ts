import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Sustainable product organization (Goal Tree).
 *
 * Dettmer's Intermediate Objectives Map applied to running an
 * engineering / product org over multiple years. The Goal sits at
 * the top; below it, three Critical Success Factors decompose into
 * the conditions a sponsor of the org would actually look at when
 * deciding "is this org healthy?" Each CSF has the Necessary
 * Conditions that have to be present for the CSF to hold.
 *
 * The structural read is necessity, bottom-up: in order to {parent}
 * we must {child}. Each NC is concrete enough to be observed (you
 * could walk into the org and check), which is the line Dettmer
 * draws between a useful Goal Tree and motivational poster.
 */
export const buildPatternGoalTreeSustainableProductOrg = (): TPDocument => {
  const t = Date.now();

  const goal = buildEntity(
    'goal',
    'Run a product organization that ships valuable work year over year without burning out',
    t,
    1
  );

  const csf1 = buildEntity(
    'criticalSuccessFactor',
    'Decisions are made close to the work, not escalated upward',
    t,
    2
  );
  const csf2 = buildEntity(
    'criticalSuccessFactor',
    'Engineers and product managers learn from outcomes, not opinions',
    t,
    3
  );
  const csf3 = buildEntity(
    'criticalSuccessFactor',
    "The org's pace is sustainable across a quarter and across a year",
    t,
    4
  );

  const nc1 = buildEntity(
    'necessaryCondition',
    'Each team has a written charter naming the decisions it owns outright',
    t,
    5
  );
  const nc2 = buildEntity(
    'necessaryCondition',
    'Cross-team escalations resolve within 48 hours of a written request',
    t,
    6
  );
  const nc3 = buildEntity(
    'necessaryCondition',
    'Every shipped feature has a written impact review six weeks after launch',
    t,
    7
  );
  const nc4 = buildEntity(
    'necessaryCondition',
    'On-call hours per engineer stay under 80 hours per quarter',
    t,
    8
  );
  const nc5 = buildEntity(
    'necessaryCondition',
    'Voluntary attrition stays below 10% on a rolling-twelve-month basis',
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
    buildEdge(nc4.id, csf3.id, { kind: 'necessity' }),
    buildEdge(nc5.id, csf3.id, { kind: 'necessity' }),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'goalTree',
    title: 'Sustainable product organization Goal Tree',
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
