// Review comments — async, in-document feedback. Lives in `TPDocument.comments`
// so it round-trips through JSON export, share-links, and the self-contained
// HTML export. References `EntityId` / `EdgeId` for the anchor link.

import type { ClrCategory } from '../clrCategory';
import type { EdgeId, EntityId } from './ids';

/**
 * Where a review comment is anchored:
 *   - `entity` / `edge` — attached to a specific node/edge. These anchors are
 *     pruned when their target is deleted (see `pruneComments` in `graph.ts`).
 *   - `assumption` — attached to a first-class assumption record in
 *     `doc.assumptions` (record-canonical: assumptions are not entities). Pruned
 *     when the assumption is removed.
 *   - `document` — a general remark not tied to any one element.
 *   - `point` — a free-floating sticky-note pin at a canvas coordinate
 *     (`x` / `y` in flow space). Like `document`, it is never pruned — it has
 *     no entity/edge to outlive. Placed via the pane "Add comment here"
 *     context-menu action and rendered by `CommentPinsOverlay`.
 */
export type CommentAnchor =
  | { readonly kind: 'entity'; readonly entityId: EntityId }
  | { readonly kind: 'edge'; readonly edgeId: EdgeId }
  | { readonly kind: 'assumption'; readonly assumptionId: string }
  | { readonly kind: 'document' }
  | { readonly kind: 'point'; readonly x: number; readonly y: number };

/**
 * A review comment. Threads are FLAT and one level deep: a top-level comment
 * has no `parentId`; a reply carries the `parentId` of the top-level comment
 * it answers. `author` is a local display name pulled from preferences — it is
 * NOT an authenticated identity (there are no accounts; the app is local-first).
 * `body` is plain text, rendered escaped (React escapes text children), so no
 * markup is interpreted and there's no injection surface.
 */
export type Comment = {
  readonly id: string;
  readonly anchor: CommentAnchor;
  /** Plain-text body. Rendered as escaped text — no markup is interpreted. */
  readonly body: string;
  /** Local display name of the commenter. Not authenticated. */
  readonly author: string;
  /** Absent on a top-level comment; the parent comment's id on a reply.
   *  Replies are one level deep (a reply's parent is always top-level). */
  readonly parentId?: string;
  /** Marks the thread addressed. Only set on top-level comments. */
  readonly resolved?: boolean;
  /** Session 179 (Theme C) — optional CLR category this comment raises, turning
   *  it into a named "legitimate reservation" (a non-threatening disagreement
   *  vocabulary). Omitted when the comment isn't a CLR objection. */
  readonly clrCategory?: ClrCategory;
  readonly createdAt: number;
  readonly updatedAt: number;
};
