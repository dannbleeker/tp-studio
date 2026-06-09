import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Profitable subscription business (Goal Tree).
 *
 * A financial Goal Tree pointed at running a subscription business
 * with a real moat. The Goal is unsentimental ("clear net positive
 * cash for three consecutive years on the current product surface")
 * and the CSFs decompose into the three levers that actually move
 * subscription economics: acquisition cost, retention quality, and
 * the unit economics of serving each customer.
 *
 * Each Necessary Condition is a number that can be measured in a
 * board pack. Useful as a teaching template because most
 * subscription-business Goal Trees collapse into vague growth
 * narratives; this one stays grounded in cash metrics.
 */
export const buildPatternGoalTreeSubscriptionBusiness = (): TPDocument => {
  const t = Date.now();

  const goal = buildEntity(
    'goal',
    'Run a subscription business with three consecutive years of positive operating cash on the current product',
    t,
    1
  );

  const csf1 = buildEntity(
    'criticalSuccessFactor',
    'Customer acquisition pays back within twelve months',
    t,
    2
  );
  const csf2 = buildEntity(
    'criticalSuccessFactor',
    'Retention is high enough that the cohort base grows on its own',
    t,
    3
  );
  const csf3 = buildEntity(
    'criticalSuccessFactor',
    'Serving each customer leaves a healthy gross margin after support and infrastructure',
    t,
    4
  );

  const nc1 = buildEntity(
    'necessaryCondition',
    'Blended CAC across paid and organic stays below 11 months of average revenue per customer',
    t,
    5
  );
  const nc2 = buildEntity(
    'necessaryCondition',
    'Trial-to-paid conversion stays above 35% on the qualified funnel',
    t,
    6
  );
  const nc3 = buildEntity(
    'necessaryCondition',
    'Net revenue retention stays above 110% across the enterprise cohort',
    t,
    7
  );
  const nc4 = buildEntity(
    'necessaryCondition',
    'Annual logo churn stays below 6% on the SMB cohort',
    t,
    8
  );
  const nc5 = buildEntity(
    'necessaryCondition',
    'Gross margin per customer stays above 75% after support and infrastructure cost',
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
    title: 'Profitable subscription business Goal Tree',
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
