import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Make money now and in the future — T/I/OE (Goal Tree).
 *
 * Goldratt's goal statement and three operational measures from *The
 * Goal* (1984) — throughput, inventory, operating expense — poured
 * into the Goal-Tree format. The tree itself is post-Goldratt: Bill
 * Dettmer developed it (Strategic Navigation 2003 onward) from Oded
 * Cohen's Intermediate-Objectives Map at the Goldratt Institute, so
 * this pattern credits Goldratt for the content and Dettmer/Cohen for
 * the form. Dettmer's own IO-Map white paper (Goal Systems
 * International, 2007) works a closely related T/I/OE Goal Tree. Node
 * text is original.
 */
export const buildPatternGoalTreeMoneyNowAndFuture = (): TPDocument => {
  const t = Date.now();

  const goal = buildEntity('goal', 'The company makes money now and in the future', t, 1);

  const csfT = buildEntity(
    'criticalSuccessFactor',
    'Throughput keeps rising — the rate sales turn into money',
    t,
    2
  );
  const csfI = buildEntity(
    'criticalSuccessFactor',
    'Inventory keeps falling — money locked inside the system',
    t,
    3
  );
  const csfOE = buildEntity(
    'criticalSuccessFactor',
    'Operating expense stays controlled — money spent turning inventory into throughput',
    t,
    4
  );

  const ncConstraint = buildEntity(
    'necessaryCondition',
    "The system's constraint is identified and every improvement targets it",
    t,
    5
  );
  const ncDueDates = buildEntity(
    'necessaryCondition',
    'Due-date performance is strong enough to win repeat business',
    t,
    6
  );
  const ncRelease = buildEntity(
    'necessaryCondition',
    "Material is released at the constraint's pace, not to keep resources busy",
    t,
    7
  );
  const ncBatches = buildEntity(
    'necessaryCondition',
    'Batch sizes serve flow, not cost-per-part',
    t,
    8
  );
  const ncSpending = buildEntity(
    'necessaryCondition',
    'Spending rises only where it lifts constraint throughput',
    t,
    9
  );
  const ncProtective = buildEntity(
    'necessaryCondition',
    'Protective capacity at non-constraints is kept, not trimmed for efficiency',
    t,
    10
  );

  const entities = [
    goal,
    csfT,
    csfI,
    csfOE,
    ncConstraint,
    ncDueDates,
    ncRelease,
    ncBatches,
    ncSpending,
    ncProtective,
  ];
  const edges: Edge[] = [
    // The three measures are each necessary for the goal
    buildEdge(csfT.id, goal.id, { kind: 'necessity' }),
    buildEdge(csfI.id, goal.id, { kind: 'necessity' }),
    buildEdge(csfOE.id, goal.id, { kind: 'necessity' }),
    // Conditions for rising throughput
    buildEdge(ncConstraint.id, csfT.id, { kind: 'necessity' }),
    buildEdge(ncDueDates.id, csfT.id, { kind: 'necessity' }),
    // Conditions for falling inventory
    buildEdge(ncRelease.id, csfI.id, { kind: 'necessity' }),
    buildEdge(ncBatches.id, csfI.id, { kind: 'necessity' }),
    // Conditions for controlled operating expense
    buildEdge(ncSpending.id, csfOE.id, { kind: 'necessity' }),
    buildEdge(ncProtective.id, csfOE.id, { kind: 'necessity' }),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'goalTree',
    title: 'Make money now and in the future (T/I/OE)',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 11,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 10,
  };
};
