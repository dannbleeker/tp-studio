import { nanoid } from 'nanoid';
import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Pull replenishment (Future Reality Tree).
 *
 * Goldratt's distribution solution, told factory-side in *It's Not Luck*
 * (1994) and retail-side in *Isn't It Obvious?* (2009), abstracted: aggregate
 * the stock centrally where demand variability pools, replenish each location
 * daily to actual consumption, and availability rises even as total
 * inventory, write-offs, and locked-up cash fall. The cloud this breaks ships
 * as the inventory-vs-availability EC. Node text is original.
 */
export const buildPatternFRTPullReplenishment = (): TPDocument => {
  const t = Date.now();

  const injection = buildEntity(
    'injection',
    'Hold most stock at the central warehouse and replenish each location daily to what actually sold',
    t,
    1
  );

  const effCover = buildEntity(
    'effect',
    'Each location needs only days of cover instead of months',
    t,
    2
  );
  const effPooled = buildEntity(
    'effect',
    'Central stock pools the demand swings of every location',
    t,
    3
  );
  const effConsumption = buildEntity(
    'effect',
    'Replenishment follows real consumption, not a season-old forecast',
    t,
    4
  );

  const deAvailability = buildEntity(
    'desiredEffect',
    'Availability rises while total inventory falls',
    t,
    5
  );
  const deWriteOffs = buildEntity('desiredEffect', 'Write-offs and clearance sales shrink', t, 6);

  const entities = [injection, effCover, effPooled, effConsumption, deAvailability, deWriteOffs];

  const andAvail = nanoid(8);

  const edges: Edge[] = [
    // The injection changes how stock is held and replenished.
    buildEdge(injection.id, effCover.id),
    buildEdge(injection.id, effPooled.id),
    buildEdge(injection.id, effConsumption.id),
    // Days of cover AND pooled central stock jointly lift availability while inventory falls.
    buildEdge(effCover.id, deAvailability.id, { andGroupId: andAvail }),
    buildEdge(effPooled.id, deAvailability.id, { andGroupId: andAvail }),
    // Consumption-driven replenishment shrinks write-offs and clearance sales.
    buildEdge(effConsumption.id, deWriteOffs.id),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'frt',
    title: 'Pull-replenishment FRT',
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
