import { nanoid } from 'nanoid';
import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Local-optimum measure — "tons per hour" (Current Reality Tree).
 *
 * The archetypal Goldratt CRT: a single local performance measure is the root
 * cause feeding a spray of UDEs. Reward the melt shop on tons poured per hour
 * and operators run the furnace flat out, decoupled from what finishing
 * actually needs — so WIP piles up between stages, the easy grades get poured
 * instead of the ordered mix, inventory balloons, and orders ship late.
 *
 * Includes an AND on the late-orders UDE: a congested WIP queue AND the wrong
 * product mix must both hold for orders to miss their due dates. The
 * inventory-balloon UDE rides off the WIP climb directly. Its FRT counterpart
 * (`frt-schedule-adherence`) swaps the measure and traces the cascade upward
 * into desirable effects.
 */
export const buildPatternCRTTonsPerHour = (): TPDocument => {
  const t = Date.now();

  const rcMeasure = buildEntity(
    'rootCause',
    'The melt shop is measured and rewarded on tons poured per hour',
    t,
    1
  );
  const behFlatOut = buildEntity(
    'effect',
    'Operators run the furnace flat out, decoupled from what finishing needs',
    t,
    2
  );
  const effWip = buildEntity(
    'effect',
    'Work-in-process piles up between the furnace and finishing',
    t,
    3
  );
  const effMix = buildEntity(
    'effect',
    'The shop pours the easy grades, not the ordered product mix',
    t,
    4
  );
  const udeInventory = buildEntity('ude', 'Finished-goods and WIP inventory balloon', t, 5);
  const udeLate = buildEntity('ude', 'Customer orders ship late and miss their due dates', t, 6);

  const entities = [rcMeasure, behFlatOut, effWip, effMix, udeInventory, udeLate];

  const andLate = nanoid(8);

  const edges: Edge[] = [
    // The local measure drives the flat-out behaviour.
    buildEdge(rcMeasure.id, behFlatOut.id),
    // That behaviour sprays into two intermediate effects.
    buildEdge(behFlatOut.id, effWip.id),
    buildEdge(behFlatOut.id, effMix.id),
    // WIP between stages balloons total inventory directly.
    buildEdge(effWip.id, udeInventory.id),
    // Congested WIP AND the wrong mix jointly make orders ship late.
    buildEdge(effWip.id, udeLate.id, { andGroupId: andLate }),
    buildEdge(effMix.id, udeLate.id, { andGroupId: andLate }),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'crt',
    title: 'Tons-per-hour local optimum CRT',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 7,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 10,
  };
};
