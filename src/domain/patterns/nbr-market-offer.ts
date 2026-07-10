import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Market-offer NBR (Negative Branch Reservation). The reservation
 * raised against the consumption-based offer in Goldratt's *It's Not Luck*
 * (1994), abstracted: the stock and demand risk the offer lifts off the
 * buyer lands on the supplier's own books, and small frequent replenishment
 * loads the plant with changeovers. The mitigation keeps the offer and
 * trims the branch — a contractual consumption floor plus constraint-aware
 * replenishment scheduling. Node text is original.
 */
export const buildPatternNBRMarketOffer = (): TPDocument => {
  const t = Date.now();

  const injOriginal = buildEntity(
    'injection',
    "Hold the customer's stock and invoice per unit consumed",
    t,
    1
  );

  const effPos = buildEntity('effect', 'Buyers sign multi-year consumption agreements', t, 2);
  const dePos = buildEntity('desiredEffect', 'Share grows at full margin', t, 3);

  const effRisk = buildEntity('effect', 'Finished stock and demand risk move onto our books', t, 4);
  const effChangeovers = buildEntity(
    'effect',
    'Frequent small replenishment multiplies changeovers on the plant',
    t,
    5
  );

  const udeStranded = buildEntity(
    'ude',
    'A demand dip strands inventory we can no longer invoice',
    t,
    6
  );
  const udeCapacity = buildEntity(
    'ude',
    'Changeover load eats the capacity the offer depends on',
    t,
    7
  );

  const injMitigation = buildEntity(
    'injection',
    'Add a consumption floor to the contract and schedule replenishment around the constraint so changeovers stay off it',
    t,
    8
  );

  const entities = [
    injOriginal,
    effPos,
    dePos,
    effRisk,
    effChangeovers,
    udeStranded,
    udeCapacity,
    injMitigation,
  ];
  const edges: Edge[] = [
    // Intended positive chain
    buildEdge(injOriginal.id, effPos.id),
    buildEdge(effPos.id, dePos.id),
    // Negative branch
    buildEdge(injOriginal.id, effRisk.id),
    buildEdge(injOriginal.id, effChangeovers.id),
    buildEdge(effRisk.id, udeStranded.id),
    buildEdge(effChangeovers.id, udeCapacity.id),
    // Mitigation injection keeps the desired effect while trimming the
    // negative branch.
    buildEdge(injMitigation.id, dePos.id),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'nbr',
    title: 'Market-offer NBR',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 9,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 10,
  };
};
