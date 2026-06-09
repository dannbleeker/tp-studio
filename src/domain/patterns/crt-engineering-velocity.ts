import { nanoid } from 'nanoid';
import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Engineering velocity decline (Current Reality Tree).
 *
 * A canonical software-team CRT: sprint commitments slip, and the
 * causal chain runs through a mix of process gaps (ownership /
 * sprint sizing) and infrastructure rot (flaky tests / drifting
 * mocks). Includes an AND junctor at the "unplanned ops work"
 * intermediate effect to show how the no-tier-1-coverage root cause
 * combines with the sprint-sizing root cause to produce that effect.
 */
export const buildPatternCRTEngineeringVelocity = (): TPDocument => {
  const t = Date.now();

  // Root causes (bottom of the tree)
  const rcOps = buildEntity('rootCause', 'On-call rotation lacks tier-1 coverage', t, 1);
  const rcSizing = buildEntity('rootCause', 'Sprint capacity ignores ops load', t, 2);
  const rcReview = buildEntity('rootCause', 'PR ownership is unclear', t, 3);
  const rcMocks = buildEntity('rootCause', 'Mocked dependencies drift from production', t, 4);

  // Intermediate effects
  const effOps = buildEntity('effect', 'Engineers are pulled into unplanned ops work', t, 5);
  const effReview = buildEntity('effect', 'Code review backlog grows past 24 hours', t, 6);
  const effFlakes = buildEntity('effect', 'Test suite flakes block merges', t, 7);

  // Top UDE
  const ude = buildEntity('ude', 'Sprint commitments slip by ≥20%', t, 8);

  const entities = [rcOps, rcSizing, rcReview, rcMocks, effOps, effReview, effFlakes, ude];

  // AND-group: tier-1 gap + sprint sizing both must hold for ops drag
  // to bleed into engineering time. Lift either and the effect eases.
  const andOps = nanoid(8);

  const edges: Edge[] = [
    buildEdge(rcOps.id, effOps.id, { andGroupId: andOps }),
    buildEdge(rcSizing.id, effOps.id, { andGroupId: andOps }),
    buildEdge(rcReview.id, effReview.id),
    buildEdge(rcMocks.id, effFlakes.id),
    buildEdge(effOps.id, ude.id),
    buildEdge(effReview.id, ude.id),
    buildEdge(effFlakes.id, ude.id),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'crt',
    title: 'Engineering velocity decline',
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
