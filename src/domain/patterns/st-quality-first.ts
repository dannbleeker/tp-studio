import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Quality-first strategy (Strategy & Tactics Tree).
 *
 * A quality-as-competitive-advantage S&T. The strategic bet is that
 * customers will pay a sustained premium for a product that doesn't
 * surprise them — meaning fewer defects, fewer regressions, and a
 * support team that resolves issues fast when something does slip.
 * The tactic operationalises the bet by changing what counts as
 * "done."
 *
 * Useful as a teaching template because the Necessary Assumption
 * ("the market actually values reliability enough to pay for it")
 * is exactly the kind of upstream assumption an S&T should make
 * visible — a lot of quality programs fail not because the tactics
 * are wrong but because the assumption never held.
 */
export const buildPatternSTQualityFirst = (): TPDocument => {
  const t = Date.now();

  const apex = buildEntity(
    'goal',
    'Lift gross retention to 95% within four quarters by being the quietest product in the category',
    t,
    1
  );
  const tactic1 = buildEntity(
    'injection',
    'Add a "no surprise releases" gate that blocks any release with an unresolved P1',
    t,
    2
  );
  const subStrategy = buildEntity(
    'goal',
    'Cut customer-reported regressions per release in half',
    t,
    3
  );
  const tactic2 = buildEntity(
    'injection',
    'Require a documented test plan and one customer-shape data sample for every feature PR',
    t,
    4
  );
  const naCondition = buildEntity(
    'necessaryCondition',
    'Customers value reliability enough to renew at a premium (NA)',
    t,
    5
  );
  const saCondition = buildEntity(
    'necessaryCondition',
    'The "no surprise" gate doesn\'t slow shipping more than the renewal lift recovers (SA)',
    t,
    6
  );

  const entities = [apex, tactic1, subStrategy, tactic2, naCondition, saCondition];
  const edges: Edge[] = [
    buildEdge(tactic1.id, apex.id),
    buildEdge(subStrategy.id, tactic1.id),
    buildEdge(tactic2.id, subStrategy.id),
    buildEdge(naCondition.id, tactic2.id),
    buildEdge(saCondition.id, tactic2.id),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'st',
    title: 'Quality-first strategy S&T',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 7,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 8,
  };
};
