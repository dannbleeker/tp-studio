import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { CloudType, TPDocument } from '../types';

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
  /** Optional Cloud progression tag (TP Basics #1) — set by the cloud-type
   *  patterns (UDE / Core / Firefighting); omitted for the generic clouds. */
  readonly cloudType?: CloudType;
  /** Optional non-causal annotations pinned to a cloud box — e.g. the two
   *  "breaking channels" on Efrat's resistance cloud. Each rides as a `note`
   *  entity joined to its anchor box by a note-edge: dotted on the canvas and
   *  excluded from the CLR rules (an endpoint is a note), exactly like the
   *  boundary note on the IT-function Goal Tree. Zero-default — omit it and the
   *  cloud is the bare 5 boxes, byte-for-byte as before. */
  readonly notes?: ReadonlyArray<{
    /** The annotation text. */
    readonly text: string;
    /** Which cloud box the note hangs off (its non-causal edge endpoint). */
    readonly anchor: 'a' | 'b' | 'c' | 'd' | 'dPrime';
    /** Hand-placed canvas position — EC layout is positional, like the boxes. */
    readonly position: { readonly x: number; readonly y: number };
  }>;
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

  // Optional non-causal annotation notes (zero-default). Each note + its
  // note-edge are built together so the index access stays sound under
  // `noUncheckedIndexedAccess`. Annotation numbers continue after the 5 boxes.
  const boxBySlot = { a, b, c, d, dPrime } as const;
  const noteParts = (spec.notes ?? []).map((n, i) => {
    const note = buildEntity('note', n.text, t, 6 + i, { position: n.position });
    return { note, edge: buildEdge(boxBySlot[n.anchor].id, note.id) };
  });

  const entities = [a, b, c, d, dPrime, ...noteParts.map((p) => p.note)];
  const edges = [
    // Wants → the needs they serve.
    buildEdge(d.id, b.id, { kind: 'necessity' }),
    buildEdge(dPrime.id, c.id, { kind: 'necessity' }),
    // Needs → the common objective.
    buildEdge(b.id, a.id, { kind: 'necessity' }),
    buildEdge(c.id, a.id, { kind: 'necessity' }),
    // The conflict — only one of D / D′ can hold at once.
    buildEdge(d.id, dPrime.id, { kind: 'necessity', isMutualExclusion: true }),
    // Non-causal note-edges (dotted, CLR-excluded — a note endpoint).
    ...noteParts.map((p) => p.edge),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'ec',
    title: spec.title,
    ...(spec.cloudType ? { cloudType: spec.cloudType } : {}),
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 6 + noteParts.length,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 9,
  };
};
