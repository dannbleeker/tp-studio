import { newEdgeId, newEntityId } from '../ids';
import type { Edge, Entity, EntityId, EntityType } from '../types';

/**
 * Small entity / edge builder helpers used by every example file. Lifted
 * out of the monolith so each per-diagram builder file imports them
 * directly rather than re-implementing the id + timestamp boilerplate.
 */

export const buildEntity = (
  type: EntityType,
  title: string,
  t: number,
  annotationNumber: number,
  extras: Partial<Pick<Entity, 'ordering' | 'position' | 'unspecified' | 'description'>> = {}
): Entity => ({
  id: newEntityId(),
  type,
  title,
  annotationNumber,
  createdAt: t,
  updatedAt: t,
  ...extras,
});

export const buildEdge = (sourceId: EntityId, targetId: EntityId, andGroupId?: string): Edge => ({
  id: newEdgeId(),
  sourceId,
  targetId,
  kind: 'sufficiency',
  ...(andGroupId ? { andGroupId } : {}),
});
