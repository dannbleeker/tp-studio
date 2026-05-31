import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: WIP cap rollout (Future Reality Tree).
 *
 * A Kanban-flavoured FRT showing the downstream effects of a single
 * structural injection: cap work-in-progress at every stage of the
 * delivery flow. The injection is operationally cheap (it's a
 * policy + a dashboard, not a hire or a tool buy) but spawns a
 * tight chain of desirable effects: queues shorten, hand-offs
 * surface earlier, lead-time variance shrinks, and the team starts
 * finishing work faster than it started before.
 *
 * The chain deliberately ends at a measurable desired effect ("lead
 * time drops below two weeks at p95") rather than a vibes-level
 * outcome — the FRT is most useful as a forecast when its top is a
 * thing you can later check against reality.
 */
export const buildPatternFRTWipCap = (): TPDocument => {
  const t = Date.now();

  const injection = buildEntity(
    'injection',
    'Cap WIP at three items per delivery stage, enforced via the board',
    t,
    1
  );

  const effQueues = buildEntity(
    'effect',
    'Stage queues drain to one or two items in the first week',
    t,
    2
  );
  const effEarlyHandoff = buildEntity(
    'effect',
    'Hand-off friction surfaces visibly at the cap line',
    t,
    3
  );
  const effLessSwitching = buildEntity(
    'effect',
    'Engineers finish work before pulling new tickets',
    t,
    4
  );
  const effLowerVariance = buildEntity(
    'effect',
    'Per-ticket lead-time variance narrows by ~40%',
    t,
    5
  );

  const de = buildEntity('desiredEffect', 'Lead time drops below two weeks at p95', t, 6);

  const entities = [injection, effQueues, effEarlyHandoff, effLessSwitching, effLowerVariance, de];
  const edges: Edge[] = [
    buildEdge(injection.id, effQueues.id),
    buildEdge(injection.id, effLessSwitching.id),
    // Queue drain + finish-before-pull together expose the hand-off
    // friction; both contribute as parallel causes (independent).
    buildEdge(effQueues.id, effEarlyHandoff.id),
    buildEdge(effLessSwitching.id, effEarlyHandoff.id),
    // Variance narrowing flows from the smoother queue behaviour.
    buildEdge(effEarlyHandoff.id, effLowerVariance.id),
    // The terminal desired effect is the measurable claim the FRT is
    // ultimately about — every other effect in the tree is a
    // way-station on the path to this one.
    buildEdge(effLowerVariance.id, de.id),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'frt',
    title: 'WIP cap rollout FRT',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 7,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 9,
  };
};
