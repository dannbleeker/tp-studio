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
