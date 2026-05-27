import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Implement a fair performance-review process (Prerequisite Tree).
 *
 * A change-management PRT — useful as a teaching template because
 * the obstacles are mostly social rather than technical. Most
 * performance-review rollouts fail at exactly the obstacles named
 * here: managers who don't know how to give specific feedback, a
 * compensation policy that decouples ratings from outcomes, a
 * calibration process that turns into politicking, and a calendar
 * that puts the review in the worst week of the year.
 *
 * The IOs are deliberately structural ("require X before Y") not
 * exhortative ("train managers better"); change happens through
 * structure, not pep talks.
 */
export const buildPatternPRTPerformanceReviews = (): TPDocument => {
  const t = Date.now();

  const goal = buildEntity(
    'goal',
    'Roll out a calibrated performance-review process that improves retention of top performers',
    t,
    1
  );

  const obsFeedback = buildEntity(
    'obstacle',
    'Most managers have never been taught how to write specific behavioural feedback',
    t,
    2
  );
  const obsComp = buildEntity(
    'obstacle',
    'Compensation is decoupled from review outcomes by the current pay-band policy',
    t,
    3
  );
  const obsCalibration = buildEntity(
    'obstacle',
    'Calibration meetings devolve into trading "you owe me" rating swaps',
    t,
    4
  );
  const obsTiming = buildEntity(
    'obstacle',
    'The review window collides with the end-of-year shipping push every December',
    t,
    5
  );

  const ioFeedback = buildEntity(
    'intermediateObjective',
    'Block managers from publishing a review until they cite three observable examples',
    t,
    6
  );
  const ioComp = buildEntity(
    'intermediateObjective',
    'Couple comp adjustments to the review outcome with a documented matrix',
    t,
    7
  );
  const ioCalibration = buildEntity(
    'intermediateObjective',
    'Move calibration to a structured rubric scored before the discussion, not during',
    t,
    8
  );
  const ioTiming = buildEntity(
    'intermediateObjective',
    'Shift the review cycle to February so December stays a delivery month',
    t,
    9
  );

  const entities = [
    goal,
    obsFeedback,
    obsComp,
    obsCalibration,
    obsTiming,
    ioFeedback,
    ioComp,
    ioCalibration,
    ioTiming,
  ];
  const edges: Edge[] = [
    buildEdge(ioFeedback.id, obsFeedback.id, { kind: 'necessity' }),
    buildEdge(ioComp.id, obsComp.id, { kind: 'necessity' }),
    buildEdge(ioCalibration.id, obsCalibration.id, { kind: 'necessity' }),
    buildEdge(ioTiming.id, obsTiming.id, { kind: 'necessity' }),
    buildEdge(obsFeedback.id, goal.id, { kind: 'necessity' }),
    buildEdge(obsComp.id, goal.id, { kind: 'necessity' }),
    buildEdge(obsCalibration.id, goal.id, { kind: 'necessity' }),
    buildEdge(obsTiming.id, goal.id, { kind: 'necessity' }),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'prt',
    title: 'Performance-review rollout PRT',
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
