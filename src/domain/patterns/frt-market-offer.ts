import { nanoid } from 'nanoid';
import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Un-refusable market offer (Future Reality Tree).
 *
 * The market-segmentation move Goldratt develops in *It's Not Luck* (1994),
 * abstracted: stop selling the unit and start solving the buyer's stock
 * problem. A consumption-based supply offer removes the buyer's inventory and
 * obsolescence risk — worth far more than any discount — and a competitor
 * with only a price list cannot copy it overnight, because it rests on
 * operational capability (fast, small-batch replenishment). Pairs with the
 * commodity-price-trap CRT; its risks are examined in the market-offer NBR.
 * Node text is original.
 */
export const buildPatternFRTMarketOffer = (): TPDocument => {
  const t = Date.now();

  const injection = buildEntity(
    'injection',
    "Re-shape the offer around the buyer's biggest supply headache: hold stock for them and charge per unit consumed",
    t,
    1
  );

  const effRiskOff = buildEntity(
    'effect',
    "The buyer's inventory, obsolescence, and cash exposure move off their books",
    t,
    2
  );
  const effWorthMore = buildEntity(
    'effect',
    'The offer is worth far more to the buyer than any price discount',
    t,
    3
  );
  const effNoMatch = buildEntity(
    'effect',
    'Competitors quoting unit price alone cannot match the offer',
    t,
    4
  );

  const deCommit = buildEntity(
    'desiredEffect',
    'Buyers commit long-term without demanding a price cut',
    t,
    5
  );
  const deMargin = buildEntity('desiredEffect', 'Margin holds while market share grows', t, 6);

  const entities = [injection, effRiskOff, effWorthMore, effNoMatch, deCommit, deMargin];

  const andCommit = nanoid(8);

  const edges: Edge[] = [
    // The injection takes the stock risk off the buyer's books.
    buildEdge(injection.id, effRiskOff.id),
    // Removed risk makes the offer worth more than any discount.
    buildEdge(effRiskOff.id, effWorthMore.id),
    // Price-only competitors cannot copy the offer.
    buildEdge(injection.id, effNoMatch.id),
    // Superior value AND no competitive match jointly win long-term commitment.
    buildEdge(effWorthMore.id, deCommit.id, { andGroupId: andCommit }),
    buildEdge(effNoMatch.id, deCommit.id, { andGroupId: andCommit }),
    // Committed buyers let margin hold while share grows.
    buildEdge(deCommit.id, deMargin.id),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'frt',
    title: 'Market-offer FRT',
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
