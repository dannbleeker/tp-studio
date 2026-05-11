import { nanoid } from 'nanoid';
import type { DiagramType, Edge, Entity, EntityType, TPDocument } from './types';

const titleForDiagram = (diagramType: DiagramType): string =>
  diagramType === 'crt' ? 'Untitled CRT' : 'Untitled FRT';

export const createDocument = (diagramType: DiagramType): TPDocument => {
  const now = Date.now();
  return {
    id: nanoid(),
    diagramType,
    title: titleForDiagram(diagramType),
    entities: {},
    edges: {},
    resolvedWarnings: {},
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  };
};

export const createEntity = (params: {
  type: EntityType;
  title?: string;
}): Entity => {
  const now = Date.now();
  return {
    id: nanoid(),
    type: params.type,
    title: params.title ?? '',
    createdAt: now,
    updatedAt: now,
  };
};

export const createEdge = (params: {
  sourceId: string;
  targetId: string;
  andGroupId?: string;
}): Edge => ({
  id: nanoid(),
  sourceId: params.sourceId,
  targetId: params.targetId,
  kind: 'sufficiency',
  ...(params.andGroupId ? { andGroupId: params.andGroupId } : {}),
});
