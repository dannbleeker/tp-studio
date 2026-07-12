import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Volume-curve forecast trap (Current Reality Tree).
 *
 * The customer-side diagnosis behind the "un-refusable offer" worked in the
 * *TOC Handbook* (Ch. 22, "Mafia Offers: Dealing With a Market Constraint",
 * Lang), abstracted to any consumables/components supplier: pricing on a
 * volume curve (buy more at once, pay far less per unit) forces customers to
 * forecast months of demand across many items; the forecast is always wrong,
 * and both tails bite — too low and they stock out, too high and inventory
 * eats their cash. The exit is to change what is offered (report consumption,
 * supplier guarantees stock), i.e. the market-offer FRT, not a deeper discount.
 * Node text is original; no company names.
 */
export const buildPatternCRTForecastErrorSupply = (): TPDocument => {
  const t = Date.now();

  const rcCurve = buildEntity(
    'rootCause',
    'The industry prices on a volume curve — the more you buy at once, the far cheaper each unit',
    t,
    1
  );
  const effForecast = buildEntity(
    'effect',
    'To earn the low price, customers must forecast months of demand across many items',
    t,
    2
  );
  const effWrong = buildEntity(
    'effect',
    'The forecast is inevitably wrong in one direction or the other',
    t,
    3
  );
  const effStockout = buildEntity(
    'effect',
    'When the forecast comes in low, the customer stocks out',
    t,
    4
  );
  const udeLineDown = buildEntity(
    'ude',
    'Their line goes down — lost production, downtime, and expedited-freight costs',
    t,
    5
  );
  const effOverstock = buildEntity(
    'effect',
    'When the forecast comes in high, the customer overstocks',
    t,
    6
  );
  const udeExcess = buildEntity(
    'ude',
    'Excess inventory ties up cash and risks damage and obsolescence',
    t,
    7
  );

  const entities = [
    rcCurve,
    effForecast,
    effWrong,
    effStockout,
    udeLineDown,
    effOverstock,
    udeExcess,
  ];
  const edges: Edge[] = [
    buildEdge(rcCurve.id, effForecast.id),
    buildEdge(effForecast.id, effWrong.id),
    // Forecast too low → stockout branch.
    buildEdge(effWrong.id, effStockout.id),
    buildEdge(effStockout.id, udeLineDown.id),
    // Forecast too high → overstock branch.
    buildEdge(effWrong.id, effOverstock.id),
    buildEdge(effOverstock.id, udeExcess.id),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'crt',
    title: 'Volume-curve forecast trap',
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
