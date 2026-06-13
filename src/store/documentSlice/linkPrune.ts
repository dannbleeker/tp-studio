import type { DocumentId, EntityLink, TPDocument } from '@/domain/types';

type PruneResult = { docs: Record<DocumentId, TPDocument>; changed: TPDocument[] };

/**
 * Shared walker for the cross-document link sweeps. Rebuilds every doc in `docs`
 * keeping only the links for which `keep(link)` is true, dropping the `links`
 * field entirely when it empties (emit-or-omit). `skipDocId` is left untouched —
 * used by the on-delete sweep, which never edits the doc the entity was deleted
 * from.
 *
 * Pure. Returns both the new `docs` map and ONLY the docs that actually changed
 * (callers persist exactly those). Links are navigation metadata, so callers
 * treat this as a no-history operation and `updatedAt` is left alone. When
 * nothing matches, returns the input map unchanged with an empty `changed` list.
 */
const pruneLinks = (
  docs: Record<DocumentId, TPDocument>,
  keep: (link: EntityLink) => boolean,
  skipDocId?: DocumentId
): PruneResult => {
  const changed: TPDocument[] = [];
  let nextDocs = docs;
  for (const docId of Object.keys(docs) as DocumentId[]) {
    if (docId === skipDocId) continue;
    const doc = docs[docId];
    if (!doc) continue;
    let nextEntities: TPDocument['entities'] | null = null;
    for (const entityId of Object.keys(doc.entities)) {
      const entity = doc.entities[entityId];
      if (!entity?.links?.length) continue;
      const remaining = entity.links.filter(keep);
      if (remaining.length === entity.links.length) continue; // nothing to drop
      if (!nextEntities) nextEntities = { ...doc.entities };
      if (remaining.length === 0) {
        const { links: _drop, ...rest } = entity;
        nextEntities[entityId] = rest;
      } else {
        nextEntities[entityId] = { ...entity, links: remaining };
      }
    }
    if (nextEntities) {
      const nextDoc: TPDocument = { ...doc, entities: nextEntities };
      if (nextDocs === docs) nextDocs = { ...docs };
      nextDocs[docId] = nextDoc;
      changed.push(nextDoc);
    }
  }
  return { docs: nextDocs, changed };
};

/**
 * Sweep cross-document "mirror" links that point back to entities just deleted
 * in `fromDocId`, out of every OTHER open document in `docs`.
 *
 * Cross-tab links are reciprocal (Phase 2a): linking entity X (doc A) to entity
 * Y (doc B) writes `{docId: B, entityId: Y}` on X AND a mirror `{docId: A,
 * entityId: X}` on Y. When X is deleted, X and its own link vanish with the
 * active doc — but Y's mirror back to X lingers as a tombstone (a misleading
 * "tab closed" chip that also rides along in exports). This removes those
 * mirrors. Never touches `fromDocId`'s own entry (its entities are already gone).
 */
export const stripMirrorLinks = (
  docs: Record<DocumentId, TPDocument>,
  fromDocId: DocumentId,
  deletedIds: ReadonlySet<string>
): PruneResult => {
  if (deletedIds.size === 0) return { docs, changed: [] };
  return pruneLinks(docs, (l) => !(l.docId === fromDocId && deletedIds.has(l.entityId)), fromDocId);
};

/**
 * Sweep every cross-document link that points INTO `deletedDocId` — a doc being
 * permanently DELETED (and removed from storage) — out of every doc in `docs`.
 *
 * A plain tab CLOSE does not sweep: the doc stays reopenable from the Start
 * library, so its incoming links are kept and reconnect on reopen (the inspector
 * renders them as muted "tab closed" chips meanwhile). Only this delete path,
 * where the doc is gone for good, prunes them.
 *
 * Companion to {@link stripMirrorLinks}: that one keys on the deleted ENTITY;
 * this keys on the whole target DOC, since a deleted doc takes all of its
 * entities with it. Pass the still-open docs (the deleted doc is already gone
 * from the map); links into docs that aren't open can't be reached here, and the
 * inspector's render guard already hides those.
 */
export const stripLinksToDoc = (
  docs: Record<DocumentId, TPDocument>,
  deletedDocId: DocumentId
): PruneResult => pruneLinks(docs, (l) => l.docId !== deletedDocId);
