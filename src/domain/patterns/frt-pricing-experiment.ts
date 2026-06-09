import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Segment-specific pricing experiment (Future Reality Tree).
 *
 * A pricing FRT that walks a single commercial injection — different
 * list prices per customer segment, surfaced via the existing CPQ
 * tool — through to a desired effect on margin mix. Includes the
 * deliberate intermediate "field sales stops treating list price as
 * a starting bid" effect because pricing changes that don't shift
 * sales behaviour rarely move the metric they were supposed to.
 *
 * Two injections (a price change AND the discipline shift in the
 * field) jointly drive the desired margin effect; the FRT marks
 * the dependency explicitly via the parallel-cause edges rather
 * than collapsing them. Useful as a teaching template — many real
 * pricing tests fail because exactly the discipline-shift link is
 * missing.
 */
export const buildPatternFRTPricingExperiment = (): TPDocument => {
  const t = Date.now();

  const injPrices = buildEntity(
    'injection',
    'Set list price 12% higher for the enterprise segment, unchanged elsewhere',
    t,
    1
  );
  const injCpq = buildEntity(
    'injection',
    'Lock the CPQ tool so reps can no longer auto-apply the legacy 15% discount',
    t,
    2
  );

  const effSegmentation = buildEntity(
    'effect',
    'Enterprise quotes arrive at the higher list price without rep manipulation',
    t,
    3
  );
  const effRepBehaviour = buildEntity(
    'effect',
    'Field sales stops treating list price as a starting bid',
    t,
    4
  );
  const effChurnCheck = buildEntity(
    'effect',
    'No measurable uptick in enterprise churn during the experiment window',
    t,
    5
  );
  const effMarginPerDeal = buildEntity(
    'effect',
    'Average enterprise deal margin lifts by 4–6 points',
    t,
    6
  );

  const de = buildEntity(
    'desiredEffect',
    'Quarterly contribution margin rises one full point on flat volume',
    t,
    7
  );

  const entities = [
    injPrices,
    injCpq,
    effSegmentation,
    effRepBehaviour,
    effChurnCheck,
    effMarginPerDeal,
    de,
  ];
  const edges: Edge[] = [
    // The price change produces the higher-list quotes.
    buildEdge(injPrices.id, effSegmentation.id),
    // The CPQ lock produces the behaviour change.
    buildEdge(injCpq.id, effRepBehaviour.id),
    // The two together produce the per-deal margin lift — either alone
    // would be reversed by the missing other half.
    buildEdge(effSegmentation.id, effMarginPerDeal.id),
    buildEdge(effRepBehaviour.id, effMarginPerDeal.id),
    // The price change also has the side-effect of "did enterprise
    // walk?" — the churn check effect is a guard that the FRT relies
    // on for its claim to hold.
    buildEdge(effSegmentation.id, effChurnCheck.id),
    // Margin lift + the churn-stable signal together drive the
    // contribution-margin desired effect.
    buildEdge(effMarginPerDeal.id, de.id),
    buildEdge(effChurnCheck.id, de.id),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'frt',
    title: 'Pricing experiment FRT',
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
