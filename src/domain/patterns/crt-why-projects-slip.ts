import { nanoid } from 'nanoid';
import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Why projects slip (Current Reality Tree).
 *
 * The diagnosis of *Critical Chain* (1997) as a retrospective CRT: safety
 * hidden inside every task invites the late start, per-task judging means
 * early finishes are never passed on, and multitasking stretches every path
 * — so durations only slip one way, and each overrun teaches the next plan
 * to pad even more. Pairs with the project-task-safety cloud and the
 * critical-chain-buffering FRT. Node text is original.
 */
export const buildPatternCRTWhyProjectsSlip = (): TPDocument => {
  const t = Date.now();

  const rcSafety = buildEntity('rootCause', 'Each task estimate hides its own safety margin', t, 1);
  const rcPerTask = buildEntity(
    'rootCause',
    'People are judged per task, so finishing early earns nothing',
    t,
    2
  );
  const rcMultitask = buildEntity('rootCause', 'Everyone works several projects at once', t, 3);
  const effLateStart = buildEntity(
    'effect',
    'Work starts only when the hidden safety is nearly burned',
    t,
    4
  );
  const effSatOn = buildEntity(
    'effect',
    'Early finishes are sat on; only delays pass downstream',
    t,
    5
  );
  const effStretch = buildEntity(
    'effect',
    'Every task stretches by the queues of task-switching',
    t,
    6
  );
  const udeOneWay = buildEntity('ude', 'Path durations slip in one direction only', t, 7);
  const udePadMore = buildEntity(
    'ude',
    'Projects overrun despite generous estimates, so the next plan pads even more',
    t,
    8
  );

  const entities = [
    rcSafety,
    rcPerTask,
    rcMultitask,
    effLateStart,
    effSatOn,
    effStretch,
    udeOneWay,
    udePadMore,
  ];

  const andOneway = nanoid(8);

  const edges: Edge[] = [
    // Each root cause drives its own slippage mechanism.
    buildEdge(rcSafety.id, effLateStart.id),
    buildEdge(rcPerTask.id, effSatOn.id),
    buildEdge(rcMultitask.id, effStretch.id),
    // The three mechanisms jointly make durations slip one way only.
    buildEdge(effLateStart.id, udeOneWay.id, { andGroupId: andOneway }),
    buildEdge(effSatOn.id, udeOneWay.id, { andGroupId: andOneway }),
    buildEdge(effStretch.id, udeOneWay.id, { andGroupId: andOneway }),
    // One-way slippage teaches the next plan to pad even more.
    buildEdge(udeOneWay.id, udePadMore.id),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'crt',
    title: 'Why-projects-slip CRT',
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
