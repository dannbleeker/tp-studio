import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Quality vs speed (Evaporating Cloud).
 *
 * The teaching-classic engineering tradeoff — "do we ship the feature
 * this sprint or hold for a QA gate?" — laid out as the canonical
 * 5-box EC. Same positional convention as `buildExampleEC`:
 *   - A (common goal, left)
 *   - B (need 1, top middle)
 *   - C (need 2, bottom middle)
 *   - D (want 1, top right)
 *   - D' (want 2, bottom right)
 * with mutex arrow between D and D'.
 *
 * Wants are intentionally specific actions (not abstract priorities)
 * because the EC method is most useful when the conflict is concrete:
 * the assumption hunt happens on the "must we…?" edges only when
 * each Want is something a person could actually decide to do.
 */
const EC_POSITIONS = {
  a: { x: 100, y: 250 },
  b: { x: 450, y: 100 },
  c: { x: 450, y: 400 },
  d: { x: 800, y: 100 },
  dPrime: { x: 800, y: 400 },
} as const;

export const buildPatternECQualityVsSpeed = (): TPDocument => {
  const t = Date.now();

  const a = buildEntity('goal', 'Ship features customers love', t, 1, {
    position: EC_POSITIONS.a,
    ecSlot: 'a',
  });
  const b = buildEntity('need', 'Maintain a stable, reliable product', t, 2, {
    position: EC_POSITIONS.b,
    ecSlot: 'b',
  });
  const c = buildEntity('need', 'Ship at pace ahead of competitors', t, 3, {
    position: EC_POSITIONS.c,
    ecSlot: 'c',
  });
  const d = buildEntity('want', 'Add a 1-week QA gate to every release', t, 4, {
    position: EC_POSITIONS.d,
    ecSlot: 'd',
  });
  const dPrime = buildEntity('want', 'Release on a continuous-delivery cadence', t, 5, {
    position: EC_POSITIONS.dPrime,
    ecSlot: 'dPrime',
  });

  const entities = [a, b, c, d, dPrime];
  const edges: Edge[] = [
    // Wants → the Needs they satisfy.
    buildEdge(d.id, b.id, { kind: 'necessity' }),
    buildEdge(dPrime.id, c.id, { kind: 'necessity' }),
    // Needs → the Common goal they support.
    buildEdge(b.id, a.id, { kind: 'necessity' }),
    buildEdge(c.id, a.id, { kind: 'necessity' }),
    // The conflict — only one of D / D' can hold at once.
    buildEdge(d.id, dPrime.id, { isMutualExclusion: true }),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'ec',
    title: 'Quality vs speed Evaporating Cloud',
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
