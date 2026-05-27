import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: New-market entry (Prerequisite Tree).
 *
 * A commercial PRT in the spirit of Scheinkopf's go-to-market
 * applications. The apex is a concrete market-launch objective
 * ("ship a localised product in Germany by Q3") rather than a
 * vague "expand into Europe" — Dettmer's first rule for PRT goals
 * is that they have a date and a measurable threshold.
 *
 * The obstacles are the four kinds that bite every market entry:
 * regulatory, brand, payments, and support coverage. Each IO is
 * the specific work that clears its obstacle — not a restatement
 * of the obstacle and not a generic "do an analysis."
 */
export const buildPatternPRTNewMarketEntry = (): TPDocument => {
  const t = Date.now();

  const goal = buildEntity(
    'goal',
    'Ship a localised product in Germany by end of Q3 with paid traffic flowing',
    t,
    1
  );

  const obsRegulatory = buildEntity(
    'obstacle',
    "German consumer-protection law requires explicit cooling-off-period language we don't have",
    t,
    2
  );
  const obsBrand = buildEntity(
    'obstacle',
    'The brand has no recognition in the German market and few local references',
    t,
    3
  );
  const obsPayments = buildEntity(
    'obstacle',
    'SEPA + Klarna are table-stakes; we currently only support card payments',
    t,
    4
  );
  const obsSupport = buildEntity(
    'obstacle',
    "Customer support coverage doesn't span Central European business hours",
    t,
    5
  );

  const ioRegulatory = buildEntity(
    'intermediateObjective',
    'Engage a local consumer-law firm to draft the required terms and review every customer-facing screen',
    t,
    6
  );
  const ioBrand = buildEntity(
    'intermediateObjective',
    'Run a six-week paid pilot with two German B2B references on the landing page',
    t,
    7
  );
  const ioPayments = buildEntity(
    'intermediateObjective',
    'Integrate the SEPA + Klarna rails in the payment service and pass the launch-readiness check',
    t,
    8
  );
  const ioSupport = buildEntity(
    'intermediateObjective',
    'Hire two German-speaking support agents covering 08:00–18:00 CET',
    t,
    9
  );

  const entities = [
    goal,
    obsRegulatory,
    obsBrand,
    obsPayments,
    obsSupport,
    ioRegulatory,
    ioBrand,
    ioPayments,
    ioSupport,
  ];
  const edges: Edge[] = [
    buildEdge(ioRegulatory.id, obsRegulatory.id, { kind: 'necessity' }),
    buildEdge(ioBrand.id, obsBrand.id, { kind: 'necessity' }),
    buildEdge(ioPayments.id, obsPayments.id, { kind: 'necessity' }),
    buildEdge(ioSupport.id, obsSupport.id, { kind: 'necessity' }),
    buildEdge(obsRegulatory.id, goal.id, { kind: 'necessity' }),
    buildEdge(obsBrand.id, goal.id, { kind: 'necessity' }),
    buildEdge(obsPayments.id, goal.id, { kind: 'necessity' }),
    buildEdge(obsSupport.id, goal.id, { kind: 'necessity' }),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'prt',
    title: 'New-market entry PRT',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 10,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 8,
  };
};
