import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';
import { buildEdge, buildEntity } from './shared';

/**
 * Canonical 5-box Evaporating Cloud layout. Goal at the left, the two needs
 * above/below right of the goal, the two wants at the far right. Positions
 * are intentional (the geometry IS the diagnostic), and these same
 * coordinates seed a blank EC via `INITIAL_DOC_BY_DIAGRAM.ec` in factory.ts.
 */
const EC_POSITIONS = {
  a: { x: 100, y: 250 }, // Common goal — left
  b: { x: 450, y: 100 }, // Need 1 — top middle
  c: { x: 450, y: 400 }, // Need 2 — bottom middle
  d: { x: 800, y: 100 }, // Want 1 — top right (conflicts with D′)
  dPrime: { x: 800, y: 400 }, // Want 2 — bottom right
} as const;

export const buildExampleEC = (): TPDocument => {
  const t = Date.now();

  // Classic work/life teaching example. Read right-to-left: each want
  // satisfies a need, each need supports the common goal — yet the wants
  // conflict (one says "leave at 5", the other says "stay late").
  const a = buildEntity('goal', 'Be present for my family AND deliver at work', t, 1, {
    position: EC_POSITIONS.a,
  });
  const b = buildEntity('need', 'Spend evening time with my family', t, 2, {
    position: EC_POSITIONS.b,
  });
  const c = buildEntity('need', 'Hit my quarterly performance targets', t, 3, {
    position: EC_POSITIONS.c,
  });
  const d = buildEntity('want', 'Leave the office at 5pm every day', t, 4, {
    position: EC_POSITIONS.d,
  });
  const dPrime = buildEntity('want', 'Stay late to finish the feature on time', t, 5, {
    position: EC_POSITIONS.dPrime,
  });

  const entities = [a, b, c, d, dPrime];
  const edges: Edge[] = [
    // Wants → Needs they satisfy
    buildEdge(d.id, b.id),
    buildEdge(dPrime.id, c.id),
    // Needs → Common goal they support
    buildEdge(b.id, a.id),
    buildEdge(c.id, a.id),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'ec',
    title: 'Work / family balance Evaporating Cloud (example)',
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
