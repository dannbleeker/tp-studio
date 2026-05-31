import { nanoid } from 'nanoid';
import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Local-measure swap — schedule adherence (Future Reality Tree).
 *
 * The FRT counterpart to the "tons per hour" CRT (`crt-tons-per-hour`). Replace
 * the local measure with adherence to the finishing schedule and the cascade
 * reverses: operators pour to the schedule, the ordered mix is made in
 * sequence, WIP between stages drains to the buffer level, inventory falls, and
 * orders ship on time as plant throughput rises.
 *
 * Includes an AND on the on-time / throughput desired effect: pouring the right
 * mix AND draining the WIP queue must both hold. The inventory-falls desired
 * effect rides off the WIP drain directly. Pair this with the CRT to teach the
 * full "manage the system, not the local optimum" move.
 */
export const buildPatternFRTScheduleAdherence = (): TPDocument => {
  const t = Date.now();

  const injection = buildEntity(
    'injection',
    "Make adherence to the finishing schedule the melt shop's primary measure, replacing tons per hour",
    t,
    1
  );

  const effRunToSchedule = buildEntity(
    'effect',
    'Operators pour to the finishing schedule instead of maximising furnace output',
    t,
    2
  );
  const effRightMix = buildEntity(
    'effect',
    'The ordered product mix is poured in the right sequence',
    t,
    3
  );
  const effWipDrains = buildEntity(
    'effect',
    'WIP between the furnace and finishing drains to the buffer level',
    t,
    4
  );

  const deInventory = buildEntity(
    'desiredEffect',
    'Finished-goods and WIP inventory fall without starving finishing',
    t,
    5
  );
  const deOnTime = buildEntity(
    'desiredEffect',
    'Orders ship on time and plant throughput rises',
    t,
    6
  );

  const entities = [injection, effRunToSchedule, effRightMix, effWipDrains, deInventory, deOnTime];

  const andOnTime = nanoid(8);

  const edges: Edge[] = [
    // The injection changes the operating behaviour.
    buildEdge(injection.id, effRunToSchedule.id),
    // Running to schedule yields the right mix and a draining WIP queue.
    buildEdge(effRunToSchedule.id, effRightMix.id),
    buildEdge(effRunToSchedule.id, effWipDrains.id),
    // Draining WIP lowers total inventory directly.
    buildEdge(effWipDrains.id, deInventory.id),
    // Right mix AND drained WIP jointly produce on-time shipping + throughput.
    buildEdge(effRightMix.id, deOnTime.id, { andGroupId: andOnTime }),
    buildEdge(effWipDrains.id, deOnTime.id, { andGroupId: andOnTime }),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'frt',
    title: 'Schedule-adherence measure FRT',
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
