import type { Edge, Entity } from '@/domain/types';
import { useDocumentStore } from '@/store';

/**
 * Subscribes to a single entity by id. Returns undefined when the id is
 * undefined or the entity no longer exists in the doc.
 */
export const useEntity = (id: string | undefined): Entity | undefined =>
  useDocumentStore((s) => (id ? s.doc.entities[id] : undefined));

/**
 * Subscribes to a single edge by id. Returns undefined when the id is
 * undefined or the edge no longer exists in the doc.
 */
export const useEdge = (id: string | undefined): Edge | undefined =>
  useDocumentStore((s) => (id ? s.doc.edges[id] : undefined));

/**
 * The currently-selected entity, or undefined when the selection is an edge,
 * nothing, or a stale id.
 */
export const useSelectedEntity = (): Entity | undefined =>
  useDocumentStore((s) =>
    s.selection.kind === 'entity' ? s.doc.entities[s.selection.id] : undefined
  );

/**
 * The currently-selected edge, or undefined when the selection is an entity,
 * nothing, or a stale id.
 */
export const useSelectedEdge = (): Edge | undefined =>
  useDocumentStore((s) => (s.selection.kind === 'edge' ? s.doc.edges[s.selection.id] : undefined));
