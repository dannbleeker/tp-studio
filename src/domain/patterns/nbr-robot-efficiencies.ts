import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Automation efficiency (Negative Branch Reservation).
 *
 * The automation lesson of *The Goal* (1984) as a retrospective NBR:
 * new machines at a non-bottleneck lift a local efficiency number,
 * but the parts they pour out cannot become throughput, so WIP and
 * carrying cost climb while not one additional order ships — the
 * intended payback never arrives. The mitigation subordinates the
 * shiny asset to the bottleneck's schedule and judges it on system
 * throughput. Node text is original; no scene retelling.
 */
export const buildPatternNBRRobotEfficiencies = (): TPDocument => {
  const t = Date.now();

  const injOriginal = buildEntity(
    'injection',
    'Install automation at a non-bottleneck work centre to lift its efficiency',
    t,
    1
  );

  const effPos = buildEntity('effect', 'Cost-per-part at that centre improves on the report', t, 2);
  const dePos = buildEntity('desiredEffect', 'The automation investment actually pays back', t, 3);

  const effOverproduce = buildEntity(
    'effect',
    'The centre produces parts the bottleneck cannot consume yet',
    t,
    4
  );
  const effPileUp = buildEntity(
    'effect',
    'Excess parts pile into WIP and finished stock nobody ordered',
    t,
    5
  );

  const udeCarrying = buildEntity('ude', 'Inventory and carrying cost climb', t, 6);
  const udeNoOrders = buildEntity('ude', 'Not one additional order ships', t, 7);

  const injMitigation = buildEntity(
    'injection',
    "Judge the automation on system throughput and run it to the bottleneck's schedule",
    t,
    8
  );

  const entities = [
    injOriginal,
    effPos,
    dePos,
    effOverproduce,
    effPileUp,
    udeCarrying,
    udeNoOrders,
    injMitigation,
  ];
  const edges: Edge[] = [
    // Intended positive chain
    buildEdge(injOriginal.id, effPos.id),
    buildEdge(effPos.id, dePos.id),
    // Negative branch
    buildEdge(injOriginal.id, effOverproduce.id),
    buildEdge(effOverproduce.id, effPileUp.id),
    buildEdge(effPileUp.id, udeCarrying.id),
    buildEdge(effPileUp.id, udeNoOrders.id),
    // Mitigation injection routes around the negative branch without
    // losing the desired effect.
    buildEdge(injMitigation.id, dePos.id),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'nbr',
    title: 'Automation-efficiency NBR',
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
