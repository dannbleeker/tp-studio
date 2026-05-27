import { nanoid } from 'nanoid';
import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Sales pipeline stall (Current Reality Tree).
 *
 * A revenue-team CRT in the spirit of Scheinkopf's commercial
 * applications. Quota slips across two consecutive quarters and the
 * leadership reflex is "more activity" — more outbound, more demos,
 * more discounting. The CRT exposes that the activity-level
 * narrative misses three structural causes: late-stage qualification
 * is broken, the discount lever has trained buyers to wait, and
 * the sales-engineering team can't keep up with the demos that
 * actually convert.
 *
 * Two sub-chains converge on the apex UDE through an AND on
 * "average deal cycle stretches past 90 days" — the qualification
 * problem and the SE bottleneck jointly hold the cycle open; clear
 * either and average cycle shortens.
 */
export const buildPatternCRTSalesPipelineStall = (): TPDocument => {
  const t = Date.now();

  const rcQualification = buildEntity(
    'rootCause',
    'Reps qualify on budget signal alone; no pain validation',
    t,
    1
  );
  const rcDiscountLever = buildEntity(
    'rootCause',
    'End-of-quarter discounts run for ≥3 consecutive quarters',
    t,
    2
  );
  const rcSeBottleneck = buildEntity(
    'rootCause',
    'Sales engineers cover 4× their target deal load',
    t,
    3
  );
  const rcForecastNoise = buildEntity(
    'rootCause',
    'Forecast roll-up trusts rep commits without pipeline review',
    t,
    4
  );

  const effLateLosses = buildEntity(
    'effect',
    'Deals are lost in late stages after weeks of work',
    t,
    5
  );
  const effWaitForDiscount = buildEntity(
    'effect',
    'Prospects wait for end-of-quarter pricing before signing',
    t,
    6
  );
  const effDemoQueue = buildEntity(
    'effect',
    'Qualified prospects wait 2–3 weeks for a technical demo',
    t,
    7
  );
  const effCycleStretch = buildEntity('effect', 'Average deal cycle stretches past 90 days', t, 8);

  const ude = buildEntity('ude', 'Quarterly sales target missed two quarters in a row', t, 9);

  const entities = [
    rcQualification,
    rcDiscountLever,
    rcSeBottleneck,
    rcForecastNoise,
    effLateLosses,
    effWaitForDiscount,
    effDemoQueue,
    effCycleStretch,
    ude,
  ];

  // Late losses arise from weak qualification.
  // The discount lever creates the wait-for-discount behaviour.
  // The SE bottleneck creates the demo queue.
  // Cycle stretch is the AND of qualification problems and the SE bottleneck.
  const andCycle = nanoid(8);

  const edges: Edge[] = [
    buildEdge(rcQualification.id, effLateLosses.id),
    buildEdge(rcDiscountLever.id, effWaitForDiscount.id),
    buildEdge(rcSeBottleneck.id, effDemoQueue.id),
    // The two structural drags on cycle time combine via AND — both
    // need to hold for cycles to actually stretch past 90 days.
    buildEdge(effLateLosses.id, effCycleStretch.id, { andGroupId: andCycle }),
    buildEdge(effDemoQueue.id, effCycleStretch.id, { andGroupId: andCycle }),
    // Apex UDE pulls from cycle stretch + the wait-for-discount behaviour
    // + the forecast-noise root cause directly (the latter masks the slip
    // until the quarter closes).
    buildEdge(effCycleStretch.id, ude.id),
    buildEdge(effWaitForDiscount.id, ude.id),
    buildEdge(rcForecastNoise.id, ude.id),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'crt',
    title: 'Sales pipeline stall CRT',
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
