import type {
  DiagramType,
  DocumentId,
  Edge,
  EdgeId,
  Entity,
  EntityId,
  EntityType,
  TPDocument,
} from '@/domain/types';

let counter = 0;
const nextId = <T extends string>(prefix: string): T => `${prefix}-${++counter}` as T;

export const resetIds = (): void => {
  counter = 0;
};

export const makeEntity = (overrides: Partial<Entity> = {}): Entity => {
  const now = 1_700_000_000_000;
  const id = nextId<EntityId>('e');
  // `counter` was just incremented by nextId(); reuse it as a stable
  // annotationNumber so tests have unique, deterministic values without
  // each test having to thread one through.
  return {
    id,
    type: 'effect' satisfies EntityType,
    title: 'Default title',
    annotationNumber: counter,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
};

export const makeEdge = (
  sourceId: EntityId,
  targetId: EntityId,
  overrides: Partial<Edge> = {}
): Edge => ({
  id: nextId<EdgeId>('edge'),
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
  const maxAnnotation = entities.reduce((max, e) => Math.max(max, e.annotationNumber), 0);
  return {
    id: 'doc-1' as DocumentId,
    diagramType,
    title: 'Test document',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings,
    nextAnnotationNumber: maxAnnotation + 1,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 7,
  };
};
