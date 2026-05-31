import type { CommentAnchor, Edge, Entity } from '@/domain/types';
import type { Selection } from '@/store/uiSlice/types';

/**
 * Derive the default comment anchor from the current canvas selection.
 * A single selected entity or edge becomes that anchor; anything else
 * (nothing selected, a multi-selection, or a group) falls back to a
 * document-level ("whole diagram") comment.
 */
export function anchorFromSelection(selection: Selection): CommentAnchor {
  if (selection.kind === 'entities' && selection.ids.length === 1) {
    const id = selection.ids[0];
    if (id) return { kind: 'entity', entityId: id };
  }
  if (selection.kind === 'edges' && selection.ids.length === 1) {
    const id = selection.ids[0];
    if (id) return { kind: 'edge', edgeId: id };
  }
  return { kind: 'document' };
}

export type AnchorDescription = { text: string; missing: boolean };

/**
 * Human label for a comment's anchor. Entity → its title; edge →
 * "Source → Target"; document → "Whole diagram". `missing` is true when
 * the anchored entity/edge no longer exists — defensive only, since
 * `pruneComments` drops such comments on delete (a document-anchored
 * comment is never missing).
 */
export function describeAnchor(
  anchor: CommentAnchor,
  entities: Record<string, Entity>,
  edges: Record<string, Edge>
): AnchorDescription {
  if (anchor.kind === 'document') return { text: 'Whole diagram', missing: false };
  if (anchor.kind === 'point') return { text: 'Pinned note', missing: false };
  if (anchor.kind === 'entity') {
    const e = entities[anchor.entityId];
    return e
      ? { text: e.title.trim() || 'Untitled', missing: false }
      : { text: 'Deleted entity', missing: true };
  }
  const edge = edges[anchor.edgeId];
  if (!edge) return { text: 'Deleted connection', missing: true };
  const from = entities[edge.sourceId]?.title.trim() || '?';
  const to = entities[edge.targetId]?.title.trim() || '?';
  return { text: `${from} → ${to}`, missing: false };
}
