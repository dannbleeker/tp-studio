import type { DocumentId, TPDocument } from '@/domain/types';

/**
 * Sweep cross-document "mirror" links that point back to entities just deleted
 * in `fromDocId`, out of every OTHER open document in `docs`.
 *
 * Cross-tab links are reciprocal (Phase 2a): linking entity X (doc A) to entity
 * Y (doc B) writes `{docId: B, entityId: Y}` on X AND a mirror `{docId: A,
 * entityId: X}` on Y. When X is deleted, X and its own link vanish with the
 * active doc — but Y's mirror back to X lingers as a tombstone: it renders as a
 * misleading "tab closed" chip and rides along in exports. This removes those
 * mirrors from the open target docs.
 *
 * Pure. Never touches `fromDocId`'s own entry (its deleted entities are already
 * gone from it), and returns both the new `docs` map and the docs that actually
 * changed so the caller persists exactly those. Links are navigation metadata,
 * so callers treat this as a no-history operation; `updatedAt` is left alone
 * (housekeeping, not a user edit). When nothing matches, returns the input map
 * unchanged with an empty `changed` list.
 */
export const stripMirrorLinks = (
  docs: Record<DocumentId, TPDocument>,
  fromDocId: DocumentId,
  deletedIds: ReadonlySet<string>
): { docs: Record<DocumentId, TPDocument>; changed: TPDocument[] } => {
  if (deletedIds.size === 0) return { docs, changed: [] };
  const changed: TPDocument[] = [];
  let nextDocs = docs;
  for (const docId of Object.keys(docs) as DocumentId[]) {
    if (docId === fromDocId) continue; // never the doc we deleted from
    const doc = docs[docId];
    if (!doc) continue;
    let nextEntities: TPDocument['entities'] | null = null;
    for (const entityId of Object.keys(doc.entities)) {
      const entity = doc.entities[entityId];
      if (!entity?.links?.length) continue;
      const remaining = entity.links.filter(
        (l) => !(l.docId === fromDocId && deletedIds.has(l.entityId))
      );
      if (remaining.length === entity.links.length) continue; // no mirror to drop
      if (!nextEntities) nextEntities = { ...doc.entities };
      if (remaining.length === 0) {
        // Drop the field entirely when the last link goes (emit-or-omit).
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
