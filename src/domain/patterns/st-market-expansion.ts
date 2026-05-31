import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Geographic market expansion (Strategy & Tactics Tree).
 *
 * The apex strategy commits to opening a second geographic market
 * with a sustainable economic engine (not a flag-planting exercise).
 * The tactic is to ship the product into the new market with a
 * localised support team rather than running everything from the
 * home country. The sub-strategy underneath captures the structural
 * commitment that produces local presence.
 *
 * The assumptions surface the two things this strategy quietly
 * depends on: that the new market's segments behave like the home
 * market's (NA), and that local presence pays back inside the
 * commit window (SA). Both are the right kind of question to
 * settle before the tree closes.
 */
export const buildPatternSTMarketExpansion = (): TPDocument => {
  const t = Date.now();

  const apex = buildEntity(
    'goal',
    'Open a second geographic market that contributes 15% of revenue within three years',
    t,
    1
  );
  const tactic1 = buildEntity(
    'injection',
    'Stand up a localised go-to-market team in the new market rather than running it remote',
    t,
    2
  );
  const subStrategy = buildEntity(
    'goal',
    'Have a locally-staffed presence covering sales, support, and customer success within 9 months',
    t,
    3
  );
  const tactic2 = buildEntity(
    'injection',
    'Hire a country lead first; let them recruit the first five reps and support engineers',
    t,
    4
  );
  const naCondition = buildEntity(
    'necessaryCondition',
    'Buyer behaviour in the new market is structurally similar to the home market (NA)',
    t,
    5
  );
  const saCondition = buildEntity(
    'necessaryCondition',
    'Local presence pays back within the three-year commit window (SA)',
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
    title: 'Geographic market expansion S&T',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 7,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 9,
  };
};
