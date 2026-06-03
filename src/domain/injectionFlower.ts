// Phase 3 #3 — the "Injection Flower". In Oded Cohen's TP Basics an injection
// is vetted from three sides: the Desired Effects it should produce (an FRT),
// the Negative Branch it might trigger (an NBR), and the Plan that implements
// it (a PRT). TP Studio spreads those across separate tabs joined by the Phase
// 2a cross-doc links; this helper gathers one injection's links back into those
// canonical "petals" so the practitioner can see — at a glance — whether the
// injection is fully developed or still missing a side.
//
// Pure + framework-free: it reads the live `docs` map to resolve each link's
// target (title / doc / diagram type) and buckets by the target document's
// diagram type. No schema change — this is a read-only lens over the existing
// `Entity.links`.

import type { DiagramType, DocumentId, Entity, EntityId, TPDocument } from './types';

export type FlowerPetalRole = 'desiredEffect' | 'negativeBranch' | 'plan' | 'related';

/**
 * Canonical petal order, mirroring how an injection is vetted: what it produces
 * (desired effects) → what it risks (negative branch) → how it lands (plan) →
 * anything else linked.
 */
export const FLOWER_PETAL_ORDER: FlowerPetalRole[] = [
  'desiredEffect',
  'negativeBranch',
  'plan',
  'related',
];

/**
 * The three canonical petals whose *absence* is worth flagging as an incomplete
 * injection. The `related` catch-all is never "missing".
 */
export const CANONICAL_FLOWER_PETALS: FlowerPetalRole[] = [
  'desiredEffect',
  'negativeBranch',
  'plan',
];

export type FlowerLink = {
  docId: DocumentId;
  entityId: EntityId;
  /** Resolved live from the open tab; `null` when that tab is closed. */
  entityTitle: string | null;
  docTitle: string | null;
  diagramType: DiagramType | null;
  /** Whether the target doc + entity are both currently open (navigable). */
  reachable: boolean;
};

export type FlowerPetal = {
  role: FlowerPetalRole;
  links: FlowerLink[];
};

export type InjectionFlower = {
  /** All four petals, in canonical order, even when empty. */
  petals: FlowerPetal[];
  /** Total links across all petals (equals `injection.links.length`). */
  linkCount: number;
};

/**
 * Which petal a linked document's diagram type belongs to. Unknown types — and
 * closed tabs, whose diagram type we can't see (the link snapshot only stores
 * ids) — fall to the `related` catch-all.
 */
export const petalRoleForDiagram = (dt: DiagramType | null): FlowerPetalRole => {
  switch (dt) {
    case 'frt':
      return 'desiredEffect';
    case 'nbr':
      return 'negativeBranch';
    case 'prt':
      return 'plan';
    case 'crt':
    case 'tt':
    case 'ec':
    case 'st':
    case 'freeform':
    case 'goalTree':
    case null:
      return 'related';
    default:
      // Exhaustiveness guard: a new DiagramType must be classified above
      // (or explicitly added to the `related` catch-all) or this won't compile.
      return dt satisfies never;
  }
};

/**
 * Group one injection's cross-doc links into the four flower petals, resolving
 * each target against the open `docs` map. Links to a closed tab still appear
 * (under `related`, marked unreachable) so nothing silently vanishes.
 */
export const buildInjectionFlower = (
  injection: Entity,
  docs: Record<string, TPDocument>
): InjectionFlower => {
  const byRole: Record<FlowerPetalRole, FlowerLink[]> = {
    desiredEffect: [],
    negativeBranch: [],
    plan: [],
    related: [],
  };
  const links = injection.links ?? [];
  for (const link of links) {
    const doc = docs[link.docId];
    const ent = doc?.entities[link.entityId];
    const diagramType = doc?.diagramType ?? null;
    byRole[petalRoleForDiagram(diagramType)].push({
      docId: link.docId,
      entityId: link.entityId,
      entityTitle: ent?.title ?? null,
      docTitle: doc?.title ?? null,
      diagramType,
      reachable: Boolean(doc && ent),
    });
  }
  return {
    petals: FLOWER_PETAL_ORDER.map((role) => ({ role, links: byRole[role] })),
    linkCount: links.length,
  };
};
