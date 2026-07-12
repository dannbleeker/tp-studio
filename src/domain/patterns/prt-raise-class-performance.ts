import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Raise class performance (Prerequisite Tree).
 *
 * An "Ambitious Target Tree" from the *TOC Handbook* (Ch. 26, "TOC for
 * Education", Suerken), abstracted: a class sets the ambitious target of being
 * the best students they can be, lists the obstacles in the way, and — the
 * pivotal move the chapter highlights — turns each obstacle from blaming others
 * into an intermediate objective they can own themselves. A warm, non-business
 * PRT that shows obstacles becoming objectives. Node text is original; no
 * names.
 */
export const buildPatternPRTRaiseClassPerformance = (): TPDocument => {
  const t = Date.now();

  const goal = buildEntity('goal', 'We are the best students we can be', t, 1);

  const obsGrumpy = buildEntity('obstacle', 'The teachers seem grumpy with us', t, 2);
  const obsStudy = buildEntity('obstacle', "We don't study", t, 3);
  const obsAttendance = buildEntity('obstacle', 'We miss classes and turn up late', t, 4);
  const obsDisrupt = buildEntity('obstacle', 'We talk and bother classmates in class', t, 5);
  const obsParticipate = buildEntity('obstacle', "We don't take part", t, 6);

  const ioListen = buildEntity(
    'intermediateObjective',
    'We listen to the teachers and respect each other',
    t,
    7
  );
  const ioStudy = buildEntity('intermediateObjective', 'We study a little every day', t, 8);
  const ioAttend = buildEntity(
    'intermediateObjective',
    'We attend regularly and arrive on time',
    t,
    9
  );
  const ioFocus = buildEntity(
    'intermediateObjective',
    'We stay focused and let the class work',
    t,
    10
  );
  const ioParticipate = buildEntity(
    'intermediateObjective',
    'We take part and contribute in class',
    t,
    11
  );

  const entities = [
    goal,
    obsGrumpy,
    obsStudy,
    obsAttendance,
    obsDisrupt,
    obsParticipate,
    ioListen,
    ioStudy,
    ioAttend,
    ioFocus,
    ioParticipate,
  ];
  const edges: Edge[] = [
    // Each intermediate objective overcomes its obstacle.
    buildEdge(ioListen.id, obsGrumpy.id, { kind: 'necessity' }),
    buildEdge(ioStudy.id, obsStudy.id, { kind: 'necessity' }),
    buildEdge(ioAttend.id, obsAttendance.id, { kind: 'necessity' }),
    buildEdge(ioFocus.id, obsDisrupt.id, { kind: 'necessity' }),
    buildEdge(ioParticipate.id, obsParticipate.id, { kind: 'necessity' }),
    // Each obstacle stands between the class and the target.
    buildEdge(obsGrumpy.id, goal.id, { kind: 'necessity' }),
    buildEdge(obsStudy.id, goal.id, { kind: 'necessity' }),
    buildEdge(obsAttendance.id, goal.id, { kind: 'necessity' }),
    buildEdge(obsDisrupt.id, goal.id, { kind: 'necessity' }),
    buildEdge(obsParticipate.id, goal.id, { kind: 'necessity' }),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'prt',
    title: 'Raise class performance (Ambitious Target Tree)',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 12,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 10,
  };
};
