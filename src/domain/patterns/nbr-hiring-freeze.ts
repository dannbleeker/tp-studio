import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Hiring freeze (Negative Branch Reservation).
 *
 * A cost-control NBR. The injection ("freeze hiring for two
 * quarters") is the kind of move a CFO can defend in a board pack
 * but produces a recognisable side-branch that the FRT view alone
 * doesn't catch: the people who would have backfilled departures
 * end up doing two jobs, the people who stay carry an invisible
 * tax, and the next year's leadership pipeline thins out because
 * nobody got a stretch role.
 *
 * The mitigation isn't "don't freeze" — it's a structural change
 * that preserves the spend reduction without growing the negative
 * branch: a freeze on net new headcount, but explicit budget for
 * critical backfills.
 */
export const buildPatternNBRHiringFreeze = (): TPDocument => {
  const t = Date.now();

  const injOriginal = buildEntity(
    'injection',
    'Freeze all new hires for two consecutive quarters',
    t,
    1
  );

  const effSavings = buildEntity('effect', 'Personnel-cost growth stops on the books', t, 2);
  const deCostControl = buildEntity(
    'desiredEffect',
    'Operating margin holds the line through the budget cycle',
    t,
    3
  );

  const effDoubleJobs = buildEntity(
    'effect',
    'Teams losing people absorb the work onto whoever stayed',
    t,
    4
  );
  const effStretchGap = buildEntity(
    'effect',
    'No internal promotions land because there are no roles to step into',
    t,
    5
  );

  const udeBurnout = buildEntity(
    'ude',
    'Voluntary attrition climbs in the second freeze quarter',
    t,
    6
  );
  const udePipeline = buildEntity(
    'ude',
    'Mid-level leadership pipeline thins by the end of the year',
    t,
    7
  );

  const injMitigation = buildEntity(
    'injection',
    'Freeze net new headcount but pre-authorise critical-role backfills with a tight rubric',
    t,
    8
  );

  const entities = [
    injOriginal,
    effSavings,
    deCostControl,
    effDoubleJobs,
    effStretchGap,
    udeBurnout,
    udePipeline,
    injMitigation,
  ];
  const edges: Edge[] = [
    // Intended positive chain
    buildEdge(injOriginal.id, effSavings.id),
    buildEdge(effSavings.id, deCostControl.id),
    // Negative branch
    buildEdge(injOriginal.id, effDoubleJobs.id),
    buildEdge(injOriginal.id, effStretchGap.id),
    buildEdge(effDoubleJobs.id, udeBurnout.id),
    buildEdge(effStretchGap.id, udePipeline.id),
    // Mitigation injection routes around the negative branch without
    // losing the desired effect.
    buildEdge(injMitigation.id, deCostControl.id),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'nbr',
    title: 'Hiring freeze NBR',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 9,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 9,
  };
};
