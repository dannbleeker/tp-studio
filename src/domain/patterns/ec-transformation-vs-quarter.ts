import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Back the transformation vs protect this quarter (Evaporating Cloud).
 *
 * The short-term-security-vs-long-term-growth instance of Efrat's generic
 * change cloud, at the org / portfolio level: leadership needs to hit this
 * quarter's numbers AND needs to build the capability the future depends on —
 * and the two compete for the same scarce resources. The classic reason a
 * sound transformation keeps getting deferred "until after this quarter."
 *
 * Same positional convention as `buildExampleEC` (A left, B/C middle, D/D'
 * right, mutex between the two Wants). Original wording.
 */
const EC_POSITIONS = {
  a: { x: 100, y: 250 },
  b: { x: 450, y: 100 },
  c: { x: 450, y: 400 },
  d: { x: 800, y: 100 },
  dPrime: { x: 800, y: 400 },
} as const;

export const buildPatternECTransformationVsQuarter = (): TPDocument => {
  const t = Date.now();

  const a = buildEntity('goal', 'The business is strong this year and next', t, 1, {
    position: EC_POSITIONS.a,
    ecSlot: 'a',
  });
  const b = buildEntity('need', "Hit this quarter's numbers", t, 2, {
    position: EC_POSITIONS.b,
    ecSlot: 'b',
  });
  const c = buildEntity('need', 'Build the capability the future needs', t, 3, {
    position: EC_POSITIONS.c,
    ecSlot: 'c',
  });
  const d = buildEntity('want', "Pour every resource into this quarter's results", t, 4, {
    position: EC_POSITIONS.d,
    ecSlot: 'd',
  });
  const dPrime = buildEntity('want', 'Divert resources into the transformation now', t, 5, {
    position: EC_POSITIONS.dPrime,
    ecSlot: 'dPrime',
  });

  const entities = [a, b, c, d, dPrime];
  const edges: Edge[] = [
    // Funding this quarter hits the numbers; funding the transformation builds
    // the future capability — the same resources can't do both.
    buildEdge(d.id, b.id, { kind: 'necessity' }),
    buildEdge(dPrime.id, c.id, { kind: 'necessity' }),
    buildEdge(b.id, a.id, { kind: 'necessity' }),
    buildEdge(c.id, a.id, { kind: 'necessity' }),
    buildEdge(d.id, dPrime.id, { isMutualExclusion: true }),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'ec',
    title: 'Transformation vs this quarter Evaporating Cloud',
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
