import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';
import { buildEdge, buildEntity } from './shared';

/**
 * Session 77 / brief §5 — Example Goal Tree showing the canonical
 * three-layer necessity structure: a single Goal at the top, three
 * Critical Success Factors below, four Necessary Conditions nested
 * under the CSFs.
 *
 * Theme: "Become the customer's first choice in our category" — generic
 * enough to read across industries while showing the shape clearly.
 *
 * Edges are necessity-typed: "in order to {parent}, we must {child}".
 */
export const buildExampleGoalTree = (): TPDocument => {
  const t = Date.now();

  const goal = buildEntity('goal', "Become the customer's first choice in our category", t, 1);

  const csf1 = buildEntity(
    'criticalSuccessFactor',
    'Customers consistently find what they need',
    t,
    2
  );
  const csf2 = buildEntity(
    'criticalSuccessFactor',
    'Customers trust the experience end-to-end',
    t,
    3
  );
  const csf3 = buildEntity('criticalSuccessFactor', 'Customers recommend us unprompted', t, 4);

  const nc1 = buildEntity('necessaryCondition', 'Range covers ≥80% of relevant intent', t, 5);
  const nc2 = buildEntity('necessaryCondition', 'On-shelf availability ≥98% on top SKUs', t, 6);
  const nc3 = buildEntity('necessaryCondition', 'Order issues resolved within 24h', t, 7);
  const nc4 = buildEntity(
    'necessaryCondition',
    'NPS ≥60 sustained across last four quarters',
    t,
    8
  );

  const entities = [goal, csf1, csf2, csf3, nc1, nc2, nc3, nc4];
  // Necessity edges read child → parent ("in order to {parent} we must {child}").
  // Session 87 hotfix: switched from the `{ ...buildEdge(…), kind: 'necessity' }`
  // spread-override pattern to `buildEdge(…, { kind: 'necessity' })` now that the
  // shared builder accepts a typed opts bag. Same output shape, less noise.
  const edges: Edge[] = [
    buildEdge(csf1.id, goal.id, { kind: 'necessity' }),
    buildEdge(csf2.id, goal.id, { kind: 'necessity' }),
    buildEdge(csf3.id, goal.id, { kind: 'necessity' }),
    buildEdge(nc1.id, csf1.id, { kind: 'necessity' }),
    buildEdge(nc2.id, csf1.id, { kind: 'necessity' }),
    buildEdge(nc3.id, csf2.id, { kind: 'necessity' }),
    buildEdge(nc4.id, csf3.id, { kind: 'necessity' }),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'goalTree',
    title: 'Customer-first Goal Tree (example)',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 9,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 8,
  };
};
