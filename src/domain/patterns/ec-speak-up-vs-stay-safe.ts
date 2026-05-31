import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Speak up vs stay safe (Evaporating Cloud).
 *
 * The identity-protection instance of Efrat's generic change cloud: a person
 * on a team needs to protect their own standing AND wants the team to fix the
 * real problems — and the first pulls toward keeping quiet while the second
 * pulls toward naming the hard issues. The everyday face of "resistance to
 * change," surfacing wherever psychological safety is thin.
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

export const buildPatternECSpeakUpVsStaySafe = (): TPDocument => {
  const t = Date.now();

  const a = buildEntity('goal', 'The team does its best work and I belong in it', t, 1, {
    position: EC_POSITIONS.a,
    ecSlot: 'a',
  });
  const b = buildEntity('need', 'Protect my standing on the team', t, 2, {
    position: EC_POSITIONS.b,
    ecSlot: 'b',
  });
  const c = buildEntity('need', 'Get the real problems on the table', t, 3, {
    position: EC_POSITIONS.c,
    ecSlot: 'c',
  });
  const d = buildEntity('want', 'Keep quiet about the hard issues', t, 4, {
    position: EC_POSITIONS.d,
    ecSlot: 'd',
  });
  const dPrime = buildEntity('want', 'Name the hard issues openly', t, 5, {
    position: EC_POSITIONS.dPrime,
    ecSlot: 'dPrime',
  });

  const entities = [a, b, c, d, dPrime];
  const edges: Edge[] = [
    // Staying quiet protects my standing; naming the issues surfaces them.
    buildEdge(d.id, b.id, { kind: 'necessity' }),
    buildEdge(dPrime.id, c.id, { kind: 'necessity' }),
    buildEdge(b.id, a.id, { kind: 'necessity' }),
    buildEdge(c.id, a.id, { kind: 'necessity' }),
    buildEdge(d.id, dPrime.id, { isMutualExclusion: true }),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'ec',
    title: 'Speak up vs stay safe Evaporating Cloud',
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
