import { nanoid } from 'nanoid';
import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Constraint turnaround (Future Reality Tree).
 *
 * The management arc of *The Goal* (1984) as a retrospective FRT — the tools
 * came later, so the book itself draws no tree. Exploit the bottleneck (no
 * idle minutes, inspect before it, offload it) and subordinate material
 * release to its pace; the backlog clears, due dates start holding, and
 * reliable delivery wins back the market until throughput and profit rise
 * while inventory falls. Complements the drum-buffer-rope FRT, which details
 * the scheduling mechanics. Node text is original.
 */
export const buildPatternFRTPlantTurnaround = (): TPDocument => {
  const t = Date.now();

  const injExploit = buildEntity(
    'injection',
    'Identify the bottleneck and squeeze it: no idle minutes, inspect before it, offload what others can do',
    t,
    1
  );
  const injSubordinate = buildEntity(
    'injection',
    'Release material only at the pace the bottleneck sets',
    t,
    2
  );

  const effHours = buildEntity('effect', 'Every bottleneck hour turns into shipped product', t, 3);
  const effWipDrains = buildEntity('effect', 'WIP drains and lead times collapse', t, 4);

  const deBacklog = buildEntity(
    'desiredEffect',
    'The overdue backlog clears and due dates start holding',
    t,
    5
  );
  const deOrders = buildEntity(
    'desiredEffect',
    'Reliable delivery wins orders the plant used to lose',
    t,
    6
  );
  const deProfit = buildEntity(
    'desiredEffect',
    'Throughput and profit rise while inventory falls',
    t,
    7
  );

  const entities = [
    injExploit,
    injSubordinate,
    effHours,
    effWipDrains,
    deBacklog,
    deOrders,
    deProfit,
  ];

  const andBacklog = nanoid(8);

  const edges: Edge[] = [
    // Each injection produces its operating effect.
    buildEdge(injExploit.id, effHours.id),
    buildEdge(injSubordinate.id, effWipDrains.id),
    // Shipped bottleneck hours AND drained WIP jointly clear the backlog.
    buildEdge(effHours.id, deBacklog.id, { andGroupId: andBacklog }),
    buildEdge(effWipDrains.id, deBacklog.id, { andGroupId: andBacklog }),
    // Holding due dates wins back orders, and won orders lift profit.
    buildEdge(deBacklog.id, deOrders.id),
    buildEdge(deOrders.id, deProfit.id),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'frt',
    title: 'Constraint-turnaround FRT',
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
