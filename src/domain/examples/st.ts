import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';
import { buildEdge, buildEntity } from './shared';

/**
 * Example Strategy & Tactics Tree (FL-DT4): a two-level decomposition
 * showing the S&T shape — an apex goal/strategy at the top, the tactic
 * that achieves it, then a child strategy fed by its own tactic and
 * supporting necessary conditions. Edges read upward: tactic supports
 * the strategy above it; necessary conditions feed into the tactic.
 *
 * Apex theme: "Grow recurring revenue 20 % YoY" — a generic enough goal
 * that the structural shape is the focus rather than the domain.
 */
export const buildExampleST = (): TPDocument => {
  const t = Date.now();

  const apex = buildEntity('goal', 'Grow recurring revenue 20% YoY', t, 1);
  const tactic1 = buildEntity('injection', 'Launch annual-plan upgrade campaign', t, 2);
  const subStrategy = buildEntity('goal', 'Convert 30% of monthly users to annual', t, 3);
  const tactic2 = buildEntity('injection', 'Offer 2-month-free upgrade incentive', t, 4);
  const naCondition = buildEntity(
    'necessaryCondition',
    'Users have been on monthly plan ≥6 months (NA)',
    t,
    5
  );
  const saCondition = buildEntity(
    'necessaryCondition',
    'Incentive economics break even within 12 months (SA)',
    t,
    6
  );

  const entities = [apex, tactic1, subStrategy, tactic2, naCondition, saCondition];
  const edges: Edge[] = [
    // Tactic 1 supports the apex strategy.
    buildEdge(tactic1.id, apex.id),
    // Sub-strategy is one layer below — the parent tactic decomposes into it.
    buildEdge(subStrategy.id, tactic1.id),
    // Tactic 2 supports the sub-strategy.
    buildEdge(tactic2.id, subStrategy.id),
    // Necessary + sufficiency assumptions feed the tactic.
    buildEdge(naCondition.id, tactic2.id),
    buildEdge(saCondition.id, tactic2.id),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'st',
    title: 'Annual-plan growth Strategy & Tactics Tree (example)',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 7,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 7,
  };
};
