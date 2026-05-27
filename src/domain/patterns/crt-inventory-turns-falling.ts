import { nanoid } from 'nanoid';
import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Inventory turns falling (Current Reality Tree).
 *
 * A manufacturing CRT in the spirit of Goldratt's classical
 * applications. Inventory turns — the textbook measure of working-
 * capital efficiency — drift downward across consecutive quarters
 * even though sales hold steady. The CRT traces it to a mix of
 * forecast-driven batch sizing, defensive safety stock at every
 * stage, and a maintenance regime that protects throughput by
 * over-buying spares.
 *
 * Includes an AND on "raw material WIP grows faster than sales" —
 * batch sizing AND defensive safety-stock policy must both hold for
 * material WIP to climb. The maintenance over-buy contributes to
 * the apex UDE directly without flowing through that effect.
 */
export const buildPatternCRTInventoryTurnsFalling = (): TPDocument => {
  const t = Date.now();

  const rcBatchSizing = buildEntity(
    'rootCause',
    'Production runs are sized to absorb changeover cost, not demand',
    t,
    1
  );
  const rcSafetyStock = buildEntity(
    'rootCause',
    'Each warehouse holds its own safety stock to protect its KPI',
    t,
    2
  );
  const rcMaintenance = buildEntity(
    'rootCause',
    'Maintenance over-orders spare parts to avoid line stoppages',
    t,
    3
  );
  const rcForecast = buildEntity(
    'rootCause',
    'Demand forecast lags actual orders by ≥6 weeks',
    t,
    4
  );

  const effBatchWip = buildEntity('effect', 'Raw material WIP grows faster than sales', t, 5);
  const effSparesPile = buildEntity(
    'effect',
    'Spare-parts inventory grows 12% YoY without throughput increase',
    t,
    6
  );
  const effObsolescence = buildEntity(
    'effect',
    'Stock written off as obsolete climbs each quarter',
    t,
    7
  );

  const ude = buildEntity('ude', 'Inventory turns drop below the plan-of-record', t, 8);

  const entities = [
    rcBatchSizing,
    rcSafetyStock,
    rcMaintenance,
    rcForecast,
    effBatchWip,
    effSparesPile,
    effObsolescence,
    ude,
  ];

  const andWip = nanoid(8);

  const edges: Edge[] = [
    // Batch sizing + safety stock jointly produce the WIP climb.
    buildEdge(rcBatchSizing.id, effBatchWip.id, { andGroupId: andWip }),
    buildEdge(rcSafetyStock.id, effBatchWip.id, { andGroupId: andWip }),
    // Maintenance over-buy produces spares pile-up directly.
    buildEdge(rcMaintenance.id, effSparesPile.id),
    // Forecast lag drives obsolescence (you bought for a demand mix
    // that's now wrong).
    buildEdge(rcForecast.id, effObsolescence.id),
    // All three intermediate effects feed the apex turns drop.
    buildEdge(effBatchWip.id, ude.id),
    buildEdge(effSparesPile.id, ude.id),
    buildEdge(effObsolescence.id, ude.id),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'crt',
    title: 'Inventory turns falling CRT',
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
