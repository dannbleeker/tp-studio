import { edgesArray } from './graphCore';
import type { Assumption, Comment, Edge, Entity, EntityId, TPDocument } from './types';

/**
 * Cascade-cleanup helpers over a TPDocument: pruning edges / assumptions /
 * comments when an entity or edge is deleted, plus the open-comment-count
 * aggregation the canvas badges read.
 *
 * Split out of `graph.ts` (Session 165). Pure — no store, no React.
 */

export const removeEntityFromEdges = (doc: TPDocument, entityId: string): Record<string, Edge> => {
  const branded = entityId as EntityId;
  // Session 108 — `edgesArray(doc)` returns the cached snapshot; the
  // store mutation that calls us then creates a NEW edges record
  // (via the spread below), so we're not violating the readonly
  // contract — we only read from the cache, never mutate it.
  const surviving = edgesArray(doc).filter((e) => e.sourceId !== branded && e.targetId !== branded);
  const result: Record<string, Edge> = {};
  for (const edge of surviving) {
    if (!edge.assumptionIds?.includes(branded)) {
      result[edge.id] = edge;
      continue;
    }
    const filtered = edge.assumptionIds.filter((a) => a !== branded);
    if (filtered.length) {
      result[edge.id] = { ...edge, assumptionIds: filtered };
    } else {
      // Omit the field rather than setting `assumptionIds: undefined`
      // (exactOptionalPropertyTypes rejects explicit undefined).
      const { assumptionIds: _drop, ...rest } = edge;
      result[edge.id] = rest;
    }
  }
  return result;
};

/**
 * Prune the first-class `doc.assumptions` map against a POST-deletion set of
 * surviving edges + entities:
 *   - drop any Assumption whose host edge no longer exists (an orphan — the
 *     causal link it annotated is gone), and
 *   - scrub any `injectionIds` entry that no longer resolves to an entity.
 *
 * Without this, deleting an edge or an entity (which cascades to its edges)
 * leaves dangling Assumption records that accumulate unbounded and survive
 * JSON export / share-link round-trips. Undo is unaffected — history stores
 * full doc snapshots, so an undo restores the pruned records.
 *
 * Returns the SAME reference when nothing changed (including the
 * no-assumptions case), so callers can spread it conditionally without
 * forcing a needless new object.
 */
export const pruneAssumptions = (
  assumptions: Record<string, Assumption> | undefined,
  survivingEdges: Record<string, Edge>,
  survivingEntities: Record<string, Entity>
): Record<string, Assumption> | undefined => {
  if (!assumptions) return assumptions;
  let changed = false;
  const next: Record<string, Assumption> = {};
  for (const [id, a] of Object.entries(assumptions)) {
    if (!survivingEdges[a.edgeId]) {
      // Host edge gone → orphaned assumption.
      changed = true;
      continue;
    }
    if (a.injectionIds && a.injectionIds.length > 0) {
      const filtered = a.injectionIds.filter((eid) => survivingEntities[eid]);
      if (filtered.length !== a.injectionIds.length) {
        changed = true;
        if (filtered.length > 0) {
          next[id] = { ...a, injectionIds: filtered };
        } else {
          // emit-or-omit: drop the field rather than store an empty array
          // (mirrors `removeEntityFromEdges` above).
          const { injectionIds: _drop, ...rest } = a;
          next[id] = rest;
        }
        continue;
      }
    }
    next[id] = a;
  }
  return changed ? next : assumptions;
};

/**
 * Prune the `doc.comments` map against a POST-deletion set of surviving edges
 * + entities: drop any comment anchored to a removed entity/edge, then drop
 * any reply whose top-level parent went with it. `document`-anchored comments
 * are never pruned. Returns the SAME reference when nothing changed (including
 * the no-comments case) so callers can spread conditionally.
 */
export const pruneComments = (
  comments: Record<string, Comment> | undefined,
  survivingEdges: Record<string, Edge>,
  survivingEntities: Record<string, Entity>
): Record<string, Comment> | undefined => {
  if (!comments) return comments;
  const anchorAlive = (c: Comment): boolean =>
    c.anchor.kind === 'document' ||
    c.anchor.kind === 'point' ||
    (c.anchor.kind === 'entity' && survivingEntities[c.anchor.entityId] !== undefined) ||
    (c.anchor.kind === 'edge' && survivingEdges[c.anchor.edgeId] !== undefined);
  const next: Record<string, Comment> = {};
  let dropped = 0;
  for (const [id, c] of Object.entries(comments)) {
    if (anchorAlive(c)) next[id] = c;
    else dropped++;
  }
  // Second pass — drop replies orphaned because their parent was removed above.
  for (const id of Object.keys(next)) {
    const c = next[id];
    if (c?.parentId !== undefined && next[c.parentId] === undefined) {
      delete next[id];
      dropped++;
    }
  }
  // Track the deletion count instead of re-enumerating both maps' keys.
  return dropped > 0 ? next : comments;
};

/**
 * Count OPEN top-level review comments per anchor — used by the canvas to
 * stamp a comment-count badge on entities / edges. "Open" = not
 * `resolved`; "top-level" = not a reply (replies fold into their parent
 * thread). Document-anchored comments aren't counted here (they have no
 * node/edge to badge). Returns empty maps when the doc has no comments.
 */
type CommentCounts = { byEntity: Map<string, number>; byEdge: Map<string, number> };
// Cache keyed on the `comments` record reference (stable until comments mutate,
// via the store's immutable updates). The node- and edge-emission hooks both
// call this per emission; the cache lets the second caller reuse the first's
// walk instead of re-scanning every comment.
const commentCountsCache = new WeakMap<Record<string, Comment>, CommentCounts>();

export const openCommentCountsByAnchor = (
  comments: Record<string, Comment> | undefined
): CommentCounts => {
  if (!comments) return { byEntity: new Map(), byEdge: new Map() };
  const cached = commentCountsCache.get(comments);
  if (cached) return cached;
  const byEntity = new Map<string, number>();
  const byEdge = new Map<string, number>();
  for (const c of Object.values(comments)) {
    if (c.parentId !== undefined) continue;
    if (c.resolved === true) continue;
    if (c.anchor.kind === 'entity') {
      byEntity.set(c.anchor.entityId, (byEntity.get(c.anchor.entityId) ?? 0) + 1);
    } else if (c.anchor.kind === 'edge') {
      byEdge.set(c.anchor.edgeId, (byEdge.get(c.anchor.edgeId) ?? 0) + 1);
    }
  }
  const result: CommentCounts = { byEntity, byEdge };
  commentCountsCache.set(comments, result);
  return result;
};
