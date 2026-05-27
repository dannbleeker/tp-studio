import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Feature-flag rollout (Transition Tree).
 *
 * A delivery TT walking from "the feature is merged behind a flag"
 * through a staged rollout to "the feature is on for every user
 * and the flag is removable." Each step's outcome is a measurable
 * cohort state, not a vibes-level "looks good" check.
 *
 * The chain models the recurring complaint that flag rollouts
 * stall — the canonical failure mode is jumping straight from
 * "internal users only" to "100% on" without the intermediate
 * cohorts that would have caught the regression. Each step here
 * names both the cohort AND the measurement gate the next step
 * relies on.
 */
export const buildPatternTTFeatureRollout = (): TPDocument => {
  const t = Date.now();

  const p1 = buildEntity('effect', 'Feature is merged to main behind a default-off flag', t, 1);

  const a1 = buildEntity('action', 'Enable the flag for the internal employee cohort only', t, 2, {
    ordering: 1,
  });
  const a2 = buildEntity('action', 'Expand the cohort to 1% of external users', t, 3, {
    ordering: 2,
  });
  const a3 = buildEntity('action', 'Expand the cohort to 25% of external users', t, 4, {
    ordering: 3,
  });
  const a4 = buildEntity('action', 'Flip the flag default to ON for new users', t, 5, {
    ordering: 4,
  });
  const a5 = buildEntity('action', 'Remove the flag from the code and ship the cleanup PR', t, 6, {
    ordering: 5,
  });

  const o1 = buildEntity(
    'effect',
    'Employee cohort is on the new path with no Sev2+ tickets after one week',
    t,
    7
  );
  const o2 = buildEntity(
    'effect',
    '1% cohort runs for one full diurnal cycle with error budget intact',
    t,
    8
  );
  const o3 = buildEntity(
    'effect',
    '25% cohort matches the control cohort on the four guardrail metrics',
    t,
    9
  );
  const o4 = buildEntity(
    'effect',
    'New users default to the new path; old users keep working',
    t,
    10
  );

  const de = buildEntity(
    'desiredEffect',
    'Feature is on for every user; flag is removed from the codebase',
    t,
    11
  );

  const g = (suffix: string): string => `and_pattern_tt_rollout_${suffix}`;

  const entities = [p1, a1, a2, a3, a4, a5, o1, o2, o3, o4, de];
  const edges: Edge[] = [
    buildEdge(p1.id, o1.id, { andGroupId: g('s1') }),
    buildEdge(a1.id, o1.id, { andGroupId: g('s1') }),
    buildEdge(o1.id, o2.id, { andGroupId: g('s2') }),
    buildEdge(a2.id, o2.id, { andGroupId: g('s2') }),
    buildEdge(o2.id, o3.id, { andGroupId: g('s3') }),
    buildEdge(a3.id, o3.id, { andGroupId: g('s3') }),
    buildEdge(o3.id, o4.id, { andGroupId: g('s4') }),
    buildEdge(a4.id, o4.id, { andGroupId: g('s4') }),
    buildEdge(o4.id, de.id, { andGroupId: g('s5') }),
    buildEdge(a5.id, de.id, { andGroupId: g('s5') }),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'tt',
    title: 'Feature-flag rollout TT',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 12,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 8,
  };
};
