import { nanoid } from 'nanoid';
import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Critical-chain buffering (Future Reality Tree).
 *
 * The solution of *Critical Chain* (1997) as an FRT: strip the per-task
 * safety, pool it into one shared project buffer, and run execution by buffer
 * consumption with relay-runner hand-offs. Aggregated variation needs far
 * less total protection, so the plan shortens and the committed date becomes
 * a promise. Completes the why-projects-slip CRT and the project-task-safety
 * cloud; a closely matching published cloud (with assumptions and injection)
 * appears in Gupta & Kerrick, JITIM 23(3/4), 2014. Node text is original.
 */
export const buildPatternFRTCriticalChain = (): TPDocument => {
  const t = Date.now();

  const injPool = buildEntity(
    'injection',
    "Estimate tasks lean and pool the stripped safety into one project buffer at the chain's end",
    t,
    1
  );
  const injRelay = buildEntity(
    'injection',
    'Run execution by buffer consumption and relay-runner hand-offs, not task due dates',
    t,
    2
  );

  const effShared = buildEntity(
    'effect',
    'Variation is absorbed by the shared buffer instead of hiding in every task',
    t,
    3
  );
  const effHandOff = buildEntity(
    'effect',
    'Work passes hands the moment it finishes; priorities come from buffer burn',
    t,
    4
  );

  const deShorter = buildEntity(
    'desiredEffect',
    'The project fits a schedule shorter than the padded plan',
    t,
    5
  );
  const dePromise = buildEntity(
    'desiredEffect',
    'Committed dates become promises the business can build on',
    t,
    6
  );

  const entities = [injPool, injRelay, effShared, effHandOff, deShorter, dePromise];

  const andShorter = nanoid(8);

  const edges: Edge[] = [
    // Each injection changes the execution behaviour it targets.
    buildEdge(injPool.id, effShared.id),
    buildEdge(injRelay.id, effHandOff.id),
    // Shared buffer AND relay hand-offs jointly shorten the schedule.
    buildEdge(effShared.id, deShorter.id, { andGroupId: andShorter }),
    buildEdge(effHandOff.id, deShorter.id, { andGroupId: andShorter }),
    // A shorter, protected schedule makes the committed date reliable.
    buildEdge(deShorter.id, dePromise.id),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'frt',
    title: 'Critical-chain buffering FRT',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 7,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 10,
  };
};
