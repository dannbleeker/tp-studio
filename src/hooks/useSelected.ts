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
 * The single currently-selected entity, or undefined when there's no entity
 * selection, more than one entity selected, an edge selection, or a stale id.
 */
export const useSelectedEntity = (): Entity | undefined =>
  useDocumentStore((s) => {
    if (s.selection.kind !== 'entities' || s.selection.ids.length !== 1) return undefined;
    const id = s.selection.ids[0];
    return id ? s.doc.entities[id] : undefined;
  });

/**
 * The single currently-selected edge, with the same single-selection semantics
 * as `useSelectedEntity`.
 */
export const useSelectedEdge = (): Edge | undefined =>
  useDocumentStore((s) => {
    if (s.selection.kind !== 'edges' || s.selection.ids.length !== 1) return undefined;
    const id = s.selection.ids[0];
    return id ? s.doc.edges[id] : undefined;
  });
