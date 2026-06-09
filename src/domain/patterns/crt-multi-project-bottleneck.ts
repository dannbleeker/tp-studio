import { nanoid } from 'nanoid';
import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Multi-project bottleneck (Current Reality Tree).
 *
 * Goldratt's Critical Chain scenario rendered as a CRT. Project
 * portfolios run multiple programmes through a single shared
 * resource pool; when management can't see (or won't acknowledge)
 * the contention, every project waits on something, milestones
 * miss across the board, and quarterly reviews surface a fleet of
 * red dashboards.
 *
 * Three root causes converge through an AND junctor on the "every
 * project waits on the shared specialist" intermediate effect —
 * the AND captures the realistic case that the specialist
 * shortage AND the lack of WIP discipline AND the politically-
 * driven date commitments all have to hold for the contention to
 * actually bite. Lift any one and the queue clears.
 */
export const buildPatternCRTMultiProjectBottleneck = (): TPDocument => {
  const t = Date.now();

  const rcSpecialist = buildEntity('rootCause', 'Only one team owns the shared platform', t, 1);
  const rcWipDiscipline = buildEntity(
    'rootCause',
    'New projects start whenever a sponsor asks',
    t,
    2
  );
  const rcDatePolitics = buildEntity(
    'rootCause',
    'Every committed date came from a steering deck, not a plan',
    t,
    3
  );
  const rcCriticalChain = buildEntity(
    'rootCause',
    'Project plans contain hidden safety in every task estimate',
    t,
    4
  );

  const effContention = buildEntity(
    'effect',
    'Every project waits on the shared specialist team',
    t,
    5
  );
  const effSafetyBurns = buildEntity(
    'effect',
    'Per-task safety burns down inside individual tasks',
    t,
    6
  );
  const effMultitasking = buildEntity(
    'effect',
    'Specialists multitask between three or more active projects',
    t,
    7
  );

  const ude = buildEntity(
    'ude',
    'A growing share of programmes miss their committed milestones',
    t,
    8
  );

  const entities = [
    rcSpecialist,
    rcWipDiscipline,
    rcDatePolitics,
    rcCriticalChain,
    effContention,
    effSafetyBurns,
    effMultitasking,
    ude,
  ];

  // The contention effect needs all three structural causes; pick any
  // one apart and the queue eases. Modelled as an AND junctor so the
  // diagram reads as "all three of these are jointly sufficient" rather
  // than "any one is enough."
  const andContention = nanoid(8);

  const edges: Edge[] = [
    buildEdge(rcSpecialist.id, effContention.id, { andGroupId: andContention }),
    buildEdge(rcWipDiscipline.id, effContention.id, { andGroupId: andContention }),
    buildEdge(rcDatePolitics.id, effContention.id, { andGroupId: andContention }),
    // Multitasking emerges from the contention effect — once everyone
    // is waiting on the same team, that team gets pulled across active
    // work.
    buildEdge(effContention.id, effMultitasking.id),
    // Critical-chain safety burn is its own root → effect path.
    buildEdge(rcCriticalChain.id, effSafetyBurns.id),
    // Both intermediate effects feed the apex UDE.
    buildEdge(effMultitasking.id, ude.id),
    buildEdge(effSafetyBurns.id, ude.id),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'crt',
    title: 'Multi-project bottleneck CRT',
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
