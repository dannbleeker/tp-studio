import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Build vs buy (Evaporating Cloud).
 *
 * The teaching-classic procurement EC. A team needs a capability
 * (here: a customer data platform) and the leadership conversation
 * collapses into "do we build it or do we buy it?" The EC exposes
 * the two underlying needs — control over how the data flows, and
 * speed to a working solution — and the conflict between the
 * specific Wants that each Need pulls toward.
 *
 * Useful as a teaching template because both sides routinely
 * pretend their Want satisfies both Needs (the "build" camp
 * insists they'll be just as fast as buying; the "buy" camp
 * insists the vendor's customisation will hand them full control).
 * The EC structure makes that handwaving visible.
 */
const EC_POSITIONS = {
  a: { x: 100, y: 250 },
  b: { x: 450, y: 100 },
  c: { x: 450, y: 400 },
  d: { x: 800, y: 100 },
  dPrime: { x: 800, y: 400 },
} as const;

export const buildPatternECBuildVsBuy = (): TPDocument => {
  const t = Date.now();

  const a = buildEntity('goal', 'Have a working customer data platform inside six months', t, 1, {
    position: EC_POSITIONS.a,
    ecSlot: 'a',
  });
  const b = buildEntity(
    'need',
    'Keep tight control of how customer data is modelled and flows',
    t,
    2,
    {
      position: EC_POSITIONS.b,
      ecSlot: 'b',
    }
  );
  const c = buildEntity(
    'need',
    'Free engineering to ship customer-facing features in parallel',
    t,
    3,
    {
      position: EC_POSITIONS.c,
      ecSlot: 'c',
    }
  );
  const d = buildEntity('want', 'Build the customer data platform in-house', t, 4, {
    position: EC_POSITIONS.d,
    ecSlot: 'd',
  });
  const dPrime = buildEntity(
    'want',
    'Adopt a vendor customer data platform with our existing connectors',
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
    title: 'Build vs buy customer data platform EC',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 6,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 8,
  };
};
