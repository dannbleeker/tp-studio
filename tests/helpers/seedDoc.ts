import type { Edge, Entity, EntityType } from '@/domain/types';
import { useDocumentStore } from '@/store';

/**
 * Shared test setup helpers. Sixty-plus test sites used to inline
 * `useDocumentStore.getState().addEntity({ type, title })` and tiny
 * factory closures (`const addNode = ...`); centralizing here cuts the
 * boilerplate and gives one place to update if the store action signature
 * ever changes.
 *
 * Each helper goes straight through the live store (no mocking) — the
 * `beforeEach(resetStoreForTest)` in every test file gives us a clean slate
 * before the seed runs.
 */

/** Add a single entity to the store and return it. */
export const seedEntity = (title = 'A', type: EntityType = 'effect'): Entity =>
  useDocumentStore.getState().addEntity({ type, title });

/**
 * Add two entities and connect `a → b`. Returns both entities plus the
 * resulting edge. Throws if `connect` returns null (which only happens for
 * self-edges or duplicates — neither possible here on a freshly-reset
 * store).
 */
export const seedConnectedPair = (
  titleA = 'Cause A',
  titleB = 'Effect B',
  type: EntityType = 'effect'
): { a: Entity; b: Entity; edge: Edge } => {
  const a = seedEntity(titleA, type);
  const b = seedEntity(titleB, type);
  const edge = useDocumentStore.getState().connect(a.id, b.id);
  if (!edge) throw new Error('connect failed in seedConnectedPair');
  return { a, b, edge };
};

/**
 * Seed N entities and connect them in order: titles[0] → titles[1] → … →
 * titles[N-1]. Returns the entity list and edge list in input order.
 * Useful for the validator / radial-layout tests that need a chain.
 */
export const seedChain = (
  titles: string[],
  type: EntityType = 'effect'
): { entities: Entity[]; edges: Edge[] } => {
  const entities = titles.map((t) => seedEntity(t, type));
  const edges: Edge[] = [];
  const state = useDocumentStore.getState();
  for (let i = 0; i < entities.length - 1; i++) {
    const a = entities[i]!;
    const b = entities[i + 1]!;
    const edge = state.connect(a.id, b.id);
    if (!edge) throw new Error(`connect ${a.id}->${b.id} failed in seedChain`);
    edges.push(edge);
  }
  return { entities, edges };
};

/**
 * Three entities + two edges forming a converging `a, b → c` shape. The
 * common setup for AND-grouping tests where two parallel edges share a
 * target. Returns the three entities and the two edges (in `a→c, b→c`
 * order).
 */
export const seedAndGroupable = (): {
  a: Entity;
  b: Entity;
  c: Entity;
  e1: Edge;
  e2: Edge;
} => {
  const a = seedEntity('A');
  const b = seedEntity('B');
  const c = seedEntity('C');
  const state = useDocumentStore.getState();
  const e1 = state.connect(a.id, c.id);
  const e2 = state.connect(b.id, c.id);
  if (!e1 || !e2) throw new Error('connect failed in seedAndGroupable');
  return { a, b, c, e1, e2 };
};
