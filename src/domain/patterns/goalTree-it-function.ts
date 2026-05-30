import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Generic IT-function goals (Goal Tree).
 *
 * From Dann Bleeker Pedersen's 2020 article *"Generic goals for an IT
 * function"* — a Dettmer-style Goal Tree / Intermediate Objectives Map for a
 * generic IT function. Because this is the author's own published work, the
 * entity titles are reproduced verbatim (the "no copy-paste from the TOC
 * literature" rule that governs the other library patterns doesn't apply).
 *
 * The article's thesis: an IT function's goal decomposes into two arms — a
 * **build-and-implement** arm (CSF A: create new value with IT assets) and an
 * **operate-efficiently** arm (CSF B: run the existing assets well), bounded
 * by a financial restriction. That shape is exactly where the classic
 * Dev-vs-Ops conflict lives. The financial-restriction boundary isn't a node
 * kind in a Goal Tree (only Goal / CSF / Necessary Condition exist), so it
 * rides as a non-causal **note** pinned above the Goal — rendered dotted
 * automatically because an endpoint is a note, and excluded from the CLR
 * rules. Its cost consequences also surface as the two cost-minimizing NCs
 * (A2 + B1).
 */
export const buildPatternGoalTreeITFunction = (): TPDocument => {
  const t = Date.now();

  const goal = buildEntity(
    'goal',
    'Ensure that technology is utilized to support the organization in reaching the overall goals, both now and in the future.',
    t,
    1
  );

  const csfA = buildEntity(
    'criticalSuccessFactor',
    'Develop and implement IT assets that bring the organization towards its goal, both now and in the future.',
    t,
    2
  );
  const csfB = buildEntity(
    'criticalSuccessFactor',
    'Ensure an efficient operation of IT assets, both now and in the future.',
    t,
    3
  );

  // CSF A — build-and-implement arm.
  const ncA1 = buildEntity(
    'necessaryCondition',
    'Create as much value with IT assets as possible, both now and in the future.',
    t,
    4
  );
  const ncA2 = buildEntity(
    'necessaryCondition',
    'Minimize the cost (and time) of developing and implementing IT assets, both now and in the future.',
    t,
    5
  );
  const ncA3 = buildEntity(
    'necessaryCondition',
    'Minimize the value of IT-inventory (assets not in production).',
    t,
    6
  );

  // CSF B — operate-efficiently arm.
  const ncB1 = buildEntity(
    'necessaryCondition',
    'Minimize the cost needed to operate the IT assets, both now and in the future.',
    t,
    7
  );
  const ncB2 = buildEntity(
    'necessaryCondition',
    'Minimize the perceived downtime for users, both now and in the future.',
    t,
    8
  );
  const ncB3 = buildEntity(
    'necessaryCondition',
    'Have the right level of IT security, both now and in the future.',
    t,
    9
  );

  // The article's bounding constraint. A Goal Tree has no boundary node kind
  // (only Goal / CSF / NC), so it rides as a non-causal note pinned to the
  // Goal — rendered dotted automatically because an endpoint is a note.
  const boundary = buildEntity('note', 'Financial restrictions must be adhered to.', t, 10);

  const entities = [goal, csfA, csfB, ncA1, ncA2, ncA3, ncB1, ncB2, ncB3, boundary];
  const edges: Edge[] = [
    // CSFs → Goal
    buildEdge(csfA.id, goal.id, { kind: 'necessity' }),
    buildEdge(csfB.id, goal.id, { kind: 'necessity' }),
    // NCs → CSF A
    buildEdge(ncA1.id, csfA.id, { kind: 'necessity' }),
    buildEdge(ncA2.id, csfA.id, { kind: 'necessity' }),
    buildEdge(ncA3.id, csfA.id, { kind: 'necessity' }),
    // NCs → CSF B
    buildEdge(ncB1.id, csfB.id, { kind: 'necessity' }),
    buildEdge(ncB2.id, csfB.id, { kind: 'necessity' }),
    buildEdge(ncB3.id, csfB.id, { kind: 'necessity' }),
    // Boundary note pinned above the Goal — dotted (note endpoint), non-causal.
    buildEdge(goal.id, boundary.id),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'goalTree',
    title: 'Generic IT-function goals (Goal Tree)',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 11,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 8,
  };
};
