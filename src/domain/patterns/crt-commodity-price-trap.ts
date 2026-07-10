import { nanoid } from 'nanoid';
import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Commodity price trap (Current Reality Tree).
 *
 * The market diagnosis behind the subsidiary turnarounds in Goldratt's *It's
 * Not Luck* (1994), abstracted to any supplier in a commodity market: when
 * every offer looks the same AND the industry carries surplus capacity, price
 * is the only lever left, and the price war erodes margins until winning an
 * order stops paying. The exit is changing what is offered, not discounting
 * deeper — see the market-offer FRT and its NBR. Node text is original.
 */
export const buildPatternCRTCommodityPriceTrap = (): TPDocument => {
  const t = Date.now();

  const rcSame = buildEntity(
    'rootCause',
    "Every supplier's offer looks identical to the buyer",
    t,
    1
  );
  const rcCapacity = buildEntity('rootCause', 'Industry capacity exceeds market demand', t, 2);
  const effPriceOnly = buildEntity(
    'effect',
    'Buyers compare on price because nothing else differs',
    t,
    3
  );
  const effFill = buildEntity(
    'effect',
    'Idle capacity pushes every supplier to fill machines at almost any price',
    t,
    4
  );
  const effPriceWar = buildEntity(
    'effect',
    'Price-cutting becomes the only way to win volume',
    t,
    5
  );
  const udeMargins = buildEntity(
    'ude',
    'Margins erode below the level that funds reinvestment',
    t,
    6
  );
  const udeOpposites = buildEntity(
    'ude',
    'Winning an order and making money on it become opposites',
    t,
    7
  );

  const entities = [
    rcSame,
    rcCapacity,
    effPriceOnly,
    effFill,
    effPriceWar,
    udeMargins,
    udeOpposites,
  ];

  const andWar = nanoid(8);

  const edges: Edge[] = [
    // Each root cause feeds its own intermediate pressure.
    buildEdge(rcSame.id, effPriceOnly.id),
    buildEdge(rcCapacity.id, effFill.id),
    // Price-only comparison AND the fill-at-any-price push jointly ignite the price war.
    buildEdge(effPriceOnly.id, effPriceWar.id, { andGroupId: andWar }),
    buildEdge(effFill.id, effPriceWar.id, { andGroupId: andWar }),
    // The price war sprays into both UDEs.
    buildEdge(effPriceWar.id, udeMargins.id),
    buildEdge(effPriceWar.id, udeOpposites.id),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'crt',
    title: 'Commodity price-trap CRT',
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
