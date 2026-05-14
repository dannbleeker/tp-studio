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
  //
  // Session 87 hotfix: ecSlot bindings + necessity-typed edges + the
  // explicit D↔D′ mutex arrow are required for the verbalisation strip
  // to interpolate real titles (rather than "the common objective"
  // placeholders), for the EntityInspector's per-slot guiding questions
  // to surface, and for `ec-completeness` / `ec-missing-conflict` CLR
  // rules to evaluate correctly. Without them the example looked
  // structurally broken once the Session 87 EC PPT chrome shipped.
  const a = buildEntity('goal', 'Be present for my family AND deliver at work', t, 1, {
    position: EC_POSITIONS.a,
    ecSlot: 'a',
  });
  const b = buildEntity('need', 'Spend evening time with my family', t, 2, {
    position: EC_POSITIONS.b,
    ecSlot: 'b',
  });
  const c = buildEntity('need', 'Hit my quarterly performance targets', t, 3, {
    position: EC_POSITIONS.c,
    ecSlot: 'c',
  });
  const d = buildEntity('want', 'Leave the office at 5pm every day', t, 4, {
    position: EC_POSITIONS.d,
    ecSlot: 'd',
  });
  const dPrime = buildEntity('want', 'Stay late to finish the feature on time', t, 5, {
    position: EC_POSITIONS.dPrime,
    ecSlot: 'dPrime',
  });

  const entities = [a, b, c, d, dPrime];
  const edges: Edge[] = [
    // Wants → Needs they satisfy.
    buildEdge(d.id, b.id, { kind: 'necessity' }),
    buildEdge(dPrime.id, c.id, { kind: 'necessity' }),
    // Needs → Common goal they support.
    buildEdge(b.id, a.id, { kind: 'necessity' }),
    buildEdge(c.id, a.id, { kind: 'necessity' }),
    // D ↔ D′ conflict — the canonical EC has 5 arrows, not 4. Without
    // this edge the `ec-missing-conflict` CLR rule fires permanently.
    buildEdge(d.id, dPrime.id, { kind: 'necessity', isMutualExclusion: true }),
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
