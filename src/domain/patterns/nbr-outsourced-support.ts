import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Outsourced support (Negative Branch Reservation).
 *
 * A cost-savings NBR. The injection ("contract a third-party
 * vendor to run tier-1 customer support") looks attractive on the
 * cost line — fully variable expense, scales with volume — but the
 * negative branch is the recognisable hollowing-out of product
 * intelligence: the people closest to the customer are no longer
 * the people building the product, the feedback signal degrades,
 * and feature decisions drift away from real customer problems.
 *
 * The mitigation isn't "don't outsource" — it's the structural
 * change that preserves the cost-curve benefit without losing the
 * signal: outsource handling but require the vendor to publish a
 * weekly issue-pattern report and route P1 escalations to the
 * internal team in under an hour.
 */
export const buildPatternNBROutsourcedSupport = (): TPDocument => {
  const t = Date.now();

  const injOriginal = buildEntity(
    'injection',
    'Contract a third-party vendor to run tier-1 customer support',
    t,
    1
  );

  const effCostScale = buildEntity(
    'effect',
    'Support cost becomes fully variable with ticket volume',
    t,
    2
  );
  const deMargin = buildEntity(
    'desiredEffect',
    'Customer-support cost as a percentage of revenue drops to plan',
    t,
    3
  );

  const effSignalLoss = buildEntity(
    'effect',
    'Product team no longer hears about issues directly from customers',
    t,
    4
  );
  const effEscalationLag = buildEntity(
    'effect',
    'Vendor escalation path adds two business days to every P1',
    t,
    5
  );

  const udeWrongFeatures = buildEntity(
    'ude',
    'Two quarters of feature investment miss the actual top customer asks',
    t,
    6
  );
  const udeChurn = buildEntity(
    'ude',
    'Enterprise customers churn citing "support response" as the primary reason',
    t,
    7
  );

  const injMitigation = buildEntity(
    'injection',
    'Outsource tier-1 but require a weekly issue-pattern report and a one-hour internal escalation SLA',
    t,
    8
  );

  const entities = [
    injOriginal,
    effCostScale,
    deMargin,
    effSignalLoss,
    effEscalationLag,
    udeWrongFeatures,
    udeChurn,
    injMitigation,
  ];
  const edges: Edge[] = [
    buildEdge(injOriginal.id, effCostScale.id),
    buildEdge(effCostScale.id, deMargin.id),
    buildEdge(injOriginal.id, effSignalLoss.id),
    buildEdge(injOriginal.id, effEscalationLag.id),
    buildEdge(effSignalLoss.id, udeWrongFeatures.id),
    buildEdge(effEscalationLag.id, udeChurn.id),
    buildEdge(injMitigation.id, deMargin.id),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'nbr',
    title: 'Outsourced support NBR',
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
