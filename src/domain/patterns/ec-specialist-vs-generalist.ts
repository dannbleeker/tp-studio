import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Specialist vs generalist hiring (Evaporating Cloud).
 *
 * A team-composition EC for the recurring tension between hiring
 * deep specialists (database engineers, ML researchers, security
 * folks) and hiring T-shaped generalists who can pick up the next
 * unknown problem. Both camps argue from the same Common Goal
 * ("build a team that delivers reliably across a five-year
 * horizon") and both have a legitimate Need; the conflict is in
 * the specific hiring action each Want demands.
 *
 * The pattern's value is showing that the conflict isn't "deep vs
 * shallow knowledge" — it's "which scarcity hurts more right now,
 * the lack of a known specialist or the inability to pivot to the
 * next unknown problem?"
 */
const EC_POSITIONS = {
  a: { x: 100, y: 250 },
  b: { x: 450, y: 100 },
  c: { x: 450, y: 400 },
  d: { x: 800, y: 100 },
  dPrime: { x: 800, y: 400 },
} as const;

export const buildPatternECSpecialistVsGeneralist = (): TPDocument => {
  const t = Date.now();

  const a = buildEntity(
    'goal',
    'Build a team that delivers reliably across a five-year horizon',
    t,
    1,
    {
      position: EC_POSITIONS.a,
      ecSlot: 'a',
    }
  );
  const b = buildEntity(
    'need',
    'Get hard problems solved by someone who has solved them before',
    t,
    2,
    {
      position: EC_POSITIONS.b,
      ecSlot: 'b',
    }
  );
  const c = buildEntity('need', "Be able to pivot the team to next year's unknown problem", t, 3, {
    position: EC_POSITIONS.c,
    ecSlot: 'c',
  });
  const d = buildEntity(
    'want',
    'Hire a specialist with deep tenure in the current problem area',
    t,
    4,
    {
      position: EC_POSITIONS.d,
      ecSlot: 'd',
    }
  );
  const dPrime = buildEntity(
    'want',
    'Hire a generalist with a track record of picking up new domains',
    t,
    5,
    {
      position: EC_POSITIONS.dPrime,
      ecSlot: 'dPrime',
    }
  );

  const entities = [a, b, c, d, dPrime];
  const edges: Edge[] = [
    buildEdge(d.id, b.id, { kind: 'necessity' }),
    buildEdge(dPrime.id, c.id, { kind: 'necessity' }),
    buildEdge(b.id, a.id, { kind: 'necessity' }),
    buildEdge(c.id, a.id, { kind: 'necessity' }),
    buildEdge(d.id, dPrime.id, { kind: 'necessity', isMutualExclusion: true }),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'ec',
    title: 'Specialist vs generalist hiring EC',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 6,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 9,
  };
};
