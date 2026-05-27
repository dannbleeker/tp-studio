import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Reduce time-to-market (Strategy & Tactics Tree).
 *
 * A concurrent-engineering S&T applied to product delivery. The
 * apex strategy is to halve the time from "we know what to build"
 * to "customers can buy it." The tactic moves the bottleneck from
 * sequential hand-offs to concurrent work streams sharing a single
 * brief. The sub-strategy captures the structural commitment
 * downstream.
 *
 * The assumptions name the two practical things this strategy
 * depends on — that the design / engineering / go-to-market teams
 * can actually keep a shared brief in sync (NA), and that the
 * sequencing benefit isn't burned up by extra coordination cost
 * (SA). Both are the right kind of question to raise before the
 * tactic ships.
 */
export const buildPatternSTTimeToMarket = (): TPDocument => {
  const t = Date.now();

  const apex = buildEntity(
    'goal',
    'Halve the time from product brief to customer-purchasable release inside one year',
    t,
    1
  );
  const tactic1 = buildEntity(
    'injection',
    'Run design, engineering, and go-to-market work streams concurrently against a single live brief',
    t,
    2
  );
  const subStrategy = buildEntity(
    'goal',
    'Have a brief format and review cadence the three streams can share without drift',
    t,
    3
  );
  const tactic2 = buildEntity(
    'injection',
    'Adopt a one-page live brief with weekly cross-team reviews and explicit deltas',
    t,
    4
  );
  const naCondition = buildEntity(
    'necessaryCondition',
    'The three teams will keep the shared brief in sync rather than forking private versions (NA)',
    t,
    5
  );
  const saCondition = buildEntity(
    'necessaryCondition',
    'Coordination overhead from the shared brief is smaller than the lead-time savings (SA)',
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
    title: 'Reduce time-to-market S&T',
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
