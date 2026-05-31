import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Resistance to change — Efrat's generic cloud (Evaporating Cloud).
 *
 * The universal "why we resist change even when we want it" conflict, after
 * Efrat Goldratt-Ashlag's generic cloud: a person simultaneously needs to
 * protect their own standing AND wants the system to improve, and those two
 * needs drive opposite actions — keep doing things the familiar way (which
 * feels safe) vs. change how things are done (which the system needs). It is
 * the most-reached-for cloud in real buy-in / facilitation work, and the
 * companion to Goldratt's Change Matrix.
 *
 * Same positional convention as `buildExampleEC`:
 *   - A (common goal, left)
 *   - B (need 1, top middle)   — protect the individual
 *   - C (need 2, bottom middle) — protect / grow the system
 *   - D (want 1, top right)     — keep the status quo (serves B)
 *   - D' (want 2, bottom right) — change (serves C)
 * with the mutex arrow between D and D'.
 *
 * Wording is original (the library's no-copy-paste convention); the structure
 * is the canonical generic shape a TOC practitioner would recognise.
 */
const EC_POSITIONS = {
  a: { x: 100, y: 250 },
  b: { x: 450, y: 100 },
  c: { x: 450, y: 400 },
  d: { x: 800, y: 100 },
  dPrime: { x: 800, y: 400 },
} as const;

export const buildPatternECEfratsChangeCloud = (): TPDocument => {
  const t = Date.now();

  const a = buildEntity('goal', 'The organisation thrives — and I thrive with it', t, 1, {
    position: EC_POSITIONS.a,
    ecSlot: 'a',
  });
  const b = buildEntity('need', 'Protect my standing and sense of security', t, 2, {
    position: EC_POSITIONS.b,
    ecSlot: 'b',
  });
  const c = buildEntity('need', 'Let the organisation adapt and improve', t, 3, {
    position: EC_POSITIONS.c,
    ecSlot: 'c',
  });
  const d = buildEntity('want', 'Keep working the way we always have', t, 4, {
    position: EC_POSITIONS.d,
    ecSlot: 'd',
  });
  const dPrime = buildEntity('want', 'Change how we work', t, 5, {
    position: EC_POSITIONS.dPrime,
    ecSlot: 'dPrime',
  });

  const entities = [a, b, c, d, dPrime];
  const edges: Edge[] = [
    // Wants → the Needs they serve. Holding to the familiar protects me;
    // changing is what lets the system improve.
    buildEdge(d.id, b.id, { kind: 'necessity' }),
    buildEdge(dPrime.id, c.id, { kind: 'necessity' }),
    // Needs → the common goal.
    buildEdge(b.id, a.id, { kind: 'necessity' }),
    buildEdge(c.id, a.id, { kind: 'necessity' }),
    // The conflict — you can't both keep the old way and change it.
    buildEdge(d.id, dPrime.id, { isMutualExclusion: true }),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'ec',
    title: "Resistance to change (Efrat's cloud)",
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
