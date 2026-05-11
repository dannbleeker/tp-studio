import { nanoid } from 'nanoid';
import type {
  DiagramType,
  DocumentId,
  Edge,
  EdgeId,
  Entity,
  EntityId,
  EntityType,
  TPDocument,
} from './types';

// nanoid returns plain `string`; cast at the factory boundary so callers
// receive a branded id without sprinkling assertions throughout the codebase.
const newEntityId = (): EntityId => nanoid() as EntityId;
const newEdgeId = (): EdgeId => nanoid() as EdgeId;
const newDocumentId = (): DocumentId => nanoid() as DocumentId;

const titleForDiagram = (diagramType: DiagramType): string =>
  diagramType === 'crt' ? 'Untitled CRT' : 'Untitled FRT';

export const createDocument = (diagramType: DiagramType): TPDocument => {
  const now = Date.now();
  return {
    id: newDocumentId(),
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
    id: newEntityId(),
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
  id: newEdgeId(),
  sourceId: params.sourceId as EntityId,
  targetId: params.targetId as EntityId,
  kind: 'sufficiency',
  ...(params.andGroupId ? { andGroupId: params.andGroupId } : {}),
});
