import type { Entity, EntityLink, TPDocument } from './types';

/** Do two link lists name the same partners, in the same order? */
const sameLinks = (a: EntityLink[] | undefined, b: EntityLink[] | undefined): boolean => {
  if (a === b) return true;
  const al = a ?? [];
  const bl = b ?? [];
  if (al.length !== bl.length) return false;
  return al.every((l, i) => l.docId === bl[i]?.docId && l.entityId === bl[i]?.entityId);
};

/** Set an entity's cross-doc `links`, dropping the field entirely when the list
 *  is empty so an unlinked entity round-trips without it (mirrors the store's
 *  `withLinks`). */
const withLinks = (entity: Entity, links: EntityLink[] | undefined): Entity => {
  if (links && links.length > 0) return { ...entity, links };
  const { links: _drop, ...rest } = entity;
  return rest;
};

/**
 * Session 206 fix — carry cross-doc `links` from the LIVE doc onto a restored
 * history snapshot.
 *
 * Linking (`linkSelectedEntityTo` / `spawnLinkedFromSelection`) deliberately
 * pushes NO history entry: a link is metadata, not content — the same rationale
 * as `markSystemScopeNudgeShown`. The catch is that undoing some *earlier*
 * content edit restores a snapshot taken BEFORE the link existed, which silently
 * stripped the link from this doc — while the reciprocal mirror survived in the
 * other document, which was never on this undo stack. The two docs then
 * disagreed about a link the user never asked to remove, and no further undo
 * could reconcile them.
 *
 * Since links are off the history stack *by design*, the consistent reading is
 * that they must survive a restore. Undoing a title edit has no business
 * destroying a link — least of all only one half of it.
 *
 * Rules:
 *   - Different doc id (a replace-mode undo restores a *different* document) →
 *     untouched; its links are its own.
 *   - Entity present in both → the live links win.
 *   - Entity only in the snapshot (undoing a delete) → keeps what it carried.
 *   - Nothing changed → the original object is returned, so the caller's
 *     identity-based memo gates don't fire needlessly.
 */
export const preserveLinks = (restored: TPDocument, live: TPDocument): TPDocument => {
  if (restored.id !== live.id) return restored;
  let changed = false;
  const entities: Record<string, Entity> = {};
  for (const [id, snapshotEntity] of Object.entries(restored.entities)) {
    const liveEntity = live.entities[id];
    if (!liveEntity || sameLinks(liveEntity.links, snapshotEntity.links)) {
      entities[id] = snapshotEntity;
      continue;
    }
    changed = true;
    entities[id] = withLinks(snapshotEntity, liveEntity.links);
  }
  return changed ? { ...restored, entities } : restored;
};
