import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { TPDocument } from '../types';

/**
 * Shared builder for the curated Evaporating Cloud patterns.
 *
 * Every EC pattern is the same 5-box cloud — only the six strings differ. This
 * collapses the per-file boilerplate (positions, the five edges, the document
 * envelope) into one place so a new cloud is just its spec, and the canonical
 * shape can't drift pattern-to-pattern. Mirrors `buildExampleEC`'s positional
 * convention and its mutex form.
 */

/** Canonical 5-box EC positions: A left, B/C middle, D/D′ right. */
const EC_POSITIONS = {
  a: { x: 100, y: 250 },
  b: { x: 450, y: 100 },
  c: { x: 450, y: 400 },
  d: { x: 800, y: 100 },
  dPrime: { x: 800, y: 400 },
} as const;

/** The six strings that distinguish one cloud from another. Everything else is
 *  the invariant cloud structure. */
export type ECPatternSpec = {
  readonly title: string;
  /** A — the common objective (goal, left). */
  readonly objective: string;
  /** B — need 1 (top middle), served by D. */
  readonly need1: string;
  /** C — need 2 (bottom middle), served by D′. */
  readonly need2: string;
  /** D — the want serving B (top right). */
  readonly want1: string;
  /** D′ — the want serving C (bottom right); in direct conflict with D. */
  readonly want2: string;
};

/**
 * Build a canonical Evaporating Cloud pattern from its spec. Structure is
 * fixed: A (goal) ← B, C (needs) ← D, D′ (wants), plus the D↔D′ conflict as a
 * mutex edge (same `{ kind: 'necessity', isMutualExclusion: true }` form as
 * `buildExampleEC`).
 */
export const buildECPattern = (spec: ECPatternSpec): TPDocument => {
  const t = Date.now();

  const a = buildEntity('goal', spec.objective, t, 1, { position: EC_POSITIONS.a, ecSlot: 'a' });
  const b = buildEntity('need', spec.need1, t, 2, { position: EC_POSITIONS.b, ecSlot: 'b' });
  const c = buildEntity('need', spec.need2, t, 3, { position: EC_POSITIONS.c, ecSlot: 'c' });
  const d = buildEntity('want', spec.want1, t, 4, { position: EC_POSITIONS.d, ecSlot: 'd' });
  const dPrime = buildEntity('want', spec.want2, t, 5, {
    position: EC_POSITIONS.dPrime,
    ecSlot: 'dPrime',
  });

  const entities = [a, b, c, d, dPrime];
  const edges = [
    // Wants → the needs they serve.
    buildEdge(d.id, b.id, { kind: 'necessity' }),
    buildEdge(dPrime.id, c.id, { kind: 'necessity' }),
    // Needs → the common objective.
    buildEdge(b.id, a.id, { kind: 'necessity' }),
    buildEdge(c.id, a.id, { kind: 'necessity' }),
    // The conflict — only one of D / D′ can hold at once.
    buildEdge(d.id, dPrime.id, { kind: 'necessity', isMutualExclusion: true }),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'ec',
    title: spec.title,
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
