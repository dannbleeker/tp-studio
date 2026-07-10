import { nanoid } from 'nanoid';
import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: The failing plant (Current Reality Tree).
 *
 * A retrospective CRT of the plant Goldratt diagnoses in *The Goal* (1984) —
 * retrospective because the Thinking Process tools were only codified a
 * decade later, so no tree appears in that book. Efficiency-and-cost-per-part
 * measures make every centre run and every batch grow, WIP floods the floor,
 * orders run late while inventory eats the cash, and closure is months away.
 * Its reversal is the constraint-turnaround FRT. Node text is original; no
 * scene retelling.
 */
export const buildPatternCRTFailingPlant = (): TPDocument => {
  const t = Date.now();

  const rcMeasures = buildEntity(
    'rootCause',
    'The plant is judged on local efficiencies and cost-per-part',
    t,
    1
  );
  const effRunAll = buildEntity(
    'effect',
    'Every work centre runs whether or not the bottleneck can use its output',
    t,
    2
  );
  const effBatches = buildEntity(
    'effect',
    'Batches are sized to flatter the efficiency numbers, not to flow',
    t,
    3
  );
  const effWip = buildEntity(
    'effect',
    'Work-in-process floods the floor and queues at the bottleneck',
    t,
    4
  );
  const udeLate = buildEntity('ude', 'Lead times stretch and orders ship chronically late', t, 5);
  const udeCash = buildEntity(
    'ude',
    'Inventory swallows the cash the plant needs to operate',
    t,
    6
  );
  const udeClosure = buildEntity('ude', 'The plant loses money and is months from closure', t, 7);

  const entities = [rcMeasures, effRunAll, effBatches, effWip, udeLate, udeCash, udeClosure];

  const andWip = nanoid(8);
  const andClosure = nanoid(8);

  const edges: Edge[] = [
    // The local measures drive both behaviours.
    buildEdge(rcMeasures.id, effRunAll.id),
    buildEdge(rcMeasures.id, effBatches.id),
    // Non-stop running AND flattering batch sizes jointly flood the floor with WIP.
    buildEdge(effRunAll.id, effWip.id, { andGroupId: andWip }),
    buildEdge(effBatches.id, effWip.id, { andGroupId: andWip }),
    // The WIP flood stretches lead times and ties up the cash.
    buildEdge(effWip.id, udeLate.id),
    buildEdge(effWip.id, udeCash.id),
    // Late orders AND starved cash jointly put the plant months from closure.
    buildEdge(udeLate.id, udeClosure.id, { andGroupId: andClosure }),
    buildEdge(udeCash.id, udeClosure.id, { andGroupId: andClosure }),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'crt',
    title: 'Failing-plant CRT',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 8,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 10,
  };
};
