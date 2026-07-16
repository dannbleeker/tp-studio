import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Strategy development (Interference Diagram) — the second of the book's
 * two ID uses (Sproull & Nelson, *Epiphanized*, App. 4, the "Increase yearly
 * revenue" worked example). Here the hub is a high-level strategic objective and
 * the interferences are the cross-functional obstacles blocking it. Unlike the
 * constraint case, these are event-driven, not time-driven — so they carry no
 * minutes; the value is surfacing them and pairing each with the injection that
 * removes it. Feed the result into a Goal Tree (the "ID/IO Simplified Strategy":
 * run "Spawn Goal Tree from this Interference Diagram").
 */
export const buildPatternIDStrategy = (): TPDocument => {
  const t = Date.now();

  const objective = buildEntity('goal', 'Increase yearly revenue', t, 1);

  const intfSales = buildEntity('obstacle', 'Product sales are too low', t, 2);
  const intfOpex = buildEntity('obstacle', 'Operating expense is too high', t, 3);
  const intfInventory = buildEntity('obstacle', 'Inventory ties up too much cash', t, 4);
  const intfTimeToMarket = buildEntity('obstacle', 'New designs reach the market too late', t, 5);
  const intfPricing = buildEntity(
    'obstacle',
    'Products are priced above what the market accepts',
    t,
    6
  );
  const intfCustomers = buildEntity('obstacle', 'Customers are not happy with delivery', t, 7);

  const ioSales = buildEntity('intermediateObjective', 'Product sales increase', t, 8);
  const ioOpex = buildEntity('intermediateObjective', 'Operating expense is controlled', t, 9);
  const ioInventory = buildEntity('intermediateObjective', 'Inventory cost is reduced', t, 10);
  const ioTimeToMarket = buildEntity(
    'intermediateObjective',
    'New designs are quick to market',
    t,
    11
  );
  const ioPricing = buildEntity(
    'intermediateObjective',
    'Pricing is competitive and profitable',
    t,
    12
  );
  const ioCustomers = buildEntity(
    'intermediateObjective',
    'Customers are delighted with on-time delivery',
    t,
    13
  );

  const entities = [
    objective,
    intfSales,
    intfOpex,
    intfInventory,
    intfTimeToMarket,
    intfPricing,
    intfCustomers,
    ioSales,
    ioOpex,
    ioInventory,
    ioTimeToMarket,
    ioPricing,
    ioCustomers,
  ];
  const edges: Edge[] = [
    buildEdge(intfSales.id, objective.id),
    buildEdge(intfOpex.id, objective.id),
    buildEdge(intfInventory.id, objective.id),
    buildEdge(intfTimeToMarket.id, objective.id),
    buildEdge(intfPricing.id, objective.id),
    buildEdge(intfCustomers.id, objective.id),
    buildEdge(ioSales.id, intfSales.id),
    buildEdge(ioOpex.id, intfOpex.id),
    buildEdge(ioInventory.id, intfInventory.id),
    buildEdge(ioTimeToMarket.id, intfTimeToMarket.id),
    buildEdge(ioPricing.id, intfPricing.id),
    buildEdge(ioCustomers.id, intfCustomers.id),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'id',
    title: 'Strategy development ID',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 14,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 10,
  };
};
