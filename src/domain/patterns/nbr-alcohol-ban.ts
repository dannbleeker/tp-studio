import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Alcohol ban (Negative Branch Reservation).
 *
 * The published negative branch from Mabin & Cavana's New Zealand case
 * (System Dynamics Review 40(4), 2024), paraphrased: a bare supermarket
 * ban pushes purchases to dedicated liquor outlets, so consumption and
 * harm can rise while retailers lose a category and fight the policy.
 * The mitigation is the case's own refinement — an adjacent-store route
 * for the retailer plus supporting price and purchase-limit levers.
 * Node text is an original paraphrase.
 */
export const buildPatternNBRAlcoholBan = (): TPDocument => {
  const t = Date.now();

  const injOriginal = buildEntity(
    'injection',
    'Ban alcohol from supermarket shelves outright',
    t,
    1
  );

  const effPos = buildEntity(
    'effect',
    'Alcohol stops being an impulse item in the weekly shop',
    t,
    2
  );
  const dePos = buildEntity('desiredEffect', 'Casual consumption and its harm decline', t, 3);

  const effSwitch = buildEntity('effect', 'Shoppers switch to dedicated liquor outlets', t, 4);
  const effStronger = buildEntity(
    'effect',
    'Liquor outlets compete on price and stronger products',
    t,
    5
  );

  const udeProfit = buildEntity(
    'ude',
    'Supermarkets lose a profitable category and fight the policy',
    t,
    6
  );
  const udeConsumption = buildEntity('ude', 'Total consumption rises instead of falling', t, 7);
  const udeHarm = buildEntity('ude', 'Alcohol-related harm deepens', t, 8);

  const injMitigation = buildEntity(
    'injection',
    'Pair the ban with an adjacent-store route for retailers plus minimum prices and purchase limits',
    t,
    9
  );

  const entities = [
    injOriginal,
    effPos,
    dePos,
    effSwitch,
    effStronger,
    udeProfit,
    udeConsumption,
    udeHarm,
    injMitigation,
  ];
  const edges: Edge[] = [
    // Intended positive chain
    buildEdge(injOriginal.id, effPos.id),
    buildEdge(effPos.id, dePos.id),
    // Negative branch: displacement to liquor outlets escalates
    buildEdge(injOriginal.id, effSwitch.id),
    buildEdge(effSwitch.id, effStronger.id),
    buildEdge(effStronger.id, udeConsumption.id),
    buildEdge(udeConsumption.id, udeHarm.id),
    // Retailer backlash off the bare ban
    buildEdge(injOriginal.id, udeProfit.id),
    // Mitigation injection preserves the desired effect
    buildEdge(injMitigation.id, dePos.id),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'nbr',
    title: 'Alcohol-ban NBR',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 10,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 10,
  };
};
