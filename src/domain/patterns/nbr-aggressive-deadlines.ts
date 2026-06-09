import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Aggressive launch deadlines (Negative Branch Reservation).
 *
 * A schedule-pressure NBR. The injection ("commit publicly to a
 * deadline three months earlier than the plan would support")
 * frames urgency as the lever — the canonical reasoning is "if we
 * say we'll ship Friday, we will ship Friday." The negative branch
 * is the recognisable cost of running on adrenaline: shortcut
 * decisions, technical debt, post-launch incident streak, and the
 * people-cost that comes due after the launch when half the team
 * needs a quiet quarter.
 *
 * The mitigation swaps schedule pressure for a smaller scope: same
 * launch date, but a tighter product cut. The desired effect ("a
 * launch that frames the company well") is preserved without the
 * UDE chain.
 */
export const buildPatternNBRAggressiveDeadlines = (): TPDocument => {
  const t = Date.now();

  const injOriginal = buildEntity(
    'injection',
    'Publicly commit to ship the full feature set three months earlier than the plan supports',
    t,
    1
  );

  const effUrgency = buildEntity(
    'effect',
    'Teams shed lower-priority work and converge on the deadline',
    t,
    2
  );
  const deLaunch = buildEntity(
    'desiredEffect',
    'Launch hits the announced date and lands publicly',
    t,
    3
  );

  const effShortcuts = buildEntity(
    'effect',
    'Engineers ship known-suboptimal solutions to fit the window',
    t,
    4
  );
  const effSilencedRisk = buildEntity(
    'effect',
    'Risk discussions get framed as "blockers" and pushed past the launch',
    t,
    5
  );

  const udeIncidents = buildEntity('ude', 'Post-launch incident rate doubles for six weeks', t, 6);
  const udeAttrition = buildEntity(
    'ude',
    'Two senior engineers quit within the quarter after launch',
    t,
    7
  );

  const injMitigation = buildEntity(
    'injection',
    'Hold the launch date but cut scope to the must-have third of the feature set',
    t,
    8
  );

  const entities = [
    injOriginal,
    effUrgency,
    deLaunch,
    effShortcuts,
    effSilencedRisk,
    udeIncidents,
    udeAttrition,
    injMitigation,
  ];
  const edges: Edge[] = [
    buildEdge(injOriginal.id, effUrgency.id),
    buildEdge(effUrgency.id, deLaunch.id),
    buildEdge(injOriginal.id, effShortcuts.id),
    buildEdge(injOriginal.id, effSilencedRisk.id),
    buildEdge(effShortcuts.id, udeIncidents.id),
    buildEdge(effSilencedRisk.id, udeIncidents.id),
    buildEdge(effShortcuts.id, udeAttrition.id),
    // Mitigation: same launch date, no negative branch.
    buildEdge(injMitigation.id, deLaunch.id),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'nbr',
    title: 'Aggressive deadlines NBR',
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
