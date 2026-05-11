import type { DiagramType, Edge, Entity, EntityType, TPDocument } from '@/domain/types';

let counter = 0;
const nextId = (prefix: string): string => `${prefix}-${++counter}`;

export const resetIds = (): void => {
  counter = 0;
};

export const makeEntity = (overrides: Partial<Entity> = {}): Entity => {
  const now = 1_700_000_000_000;
  return {
    id: nextId('e'),
    type: 'effect' satisfies EntityType,
    title: 'Default title',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
};

export const makeEdge = (
  sourceId: string,
  targetId: string,
  overrides: Partial<Edge> = {}
): Edge => ({
  id: nextId('edge'),
  sourceId,
  targetId,
  kind: 'sufficiency',
  ...overrides,
});

export const makeDoc = (
  entities: Entity[],
  edges: Edge[],
  diagramType: DiagramType = 'crt',
  resolvedWarnings: Record<string, true> = {}
): TPDocument => {
  const now = 1_700_000_000_000;
  return {
    id: 'doc-1',
    diagramType,
    title: 'Test document',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    resolvedWarnings,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  };
};
