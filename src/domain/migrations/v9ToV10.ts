import { isPlainObject, type Migration } from './shared';

/**
 * v9 → v10: collapse the assumption dual-representation to RECORD-CANONICAL.
 *
 * Pre-v10 an assumption lived twice under one id — a `type:'assumption'` entity
 * in `doc.entities` (title, position) AND a first-class `Assumption` record in
 * `doc.assumptions` (edgeId, text, status, …), kept in sync by store dual-writes.
 * From v10 the record is the ONLY home; an assumption is no longer an entity.
 *
 * For each `type:'assumption'` entity this migration:
 *   1. Ensures a matching `doc.assumptions[id]` record exists — back-filling one
 *      (text←title, edgeId via reverse-walk of edges[*].assumptionIds, exactly
 *      like v6→v7) when an older doc never minted it. Existing records win; we
 *      only fill gaps (e.g. copy the entity's `annotationNumber` onto a record
 *      that predates that field).
 *   2. REMOVES the entity from `doc.entities` (the pivot).
 *   3. Rewrites any comment anchored to it via `{kind:'entity', entityId}` into
 *      `{kind:'assumption', assumptionId}`.
 *
 * This migration leaves `edge.assumptionIds[]` on the raw doc (it was still part
 * of the v10 schema when written); the field was later removed from the model, so
 * the importer (`validateEdge`) now drops it — attachment is `record.edgeId`. An
 * orphaned assumption-entity (referenced by no edge AND with no existing record)
 * is simply dropped: it was already invisible
 * (assumptions aren't selectable nodes) and a record with `edgeId:''` would only
 * dangle.
 */
export const v9ToV10: Migration = {
  fromVersion: 9,
  toVersion: 10,
  description:
    'Record-canonical assumptions: move type:assumption entities into doc.assumptions; rewrite their comments to {kind:assumption}.',
  migrate: (raw) => {
    if (!isPlainObject(raw)) return raw;
    const entitiesRaw = isPlainObject(raw.entities) ? raw.entities : {};
    const edgesRaw = isPlainObject(raw.edges) ? raw.edges : {};
    const assumptionsRaw = isPlainObject(raw.assumptions)
      ? (raw.assumptions as Record<string, Record<string, unknown>>)
      : {};

    const movedIds = new Set<string>();
    const nextAssumptions: Record<string, Record<string, unknown>> = { ...assumptionsRaw };
    const nextEntities: Record<string, unknown> = {};

    for (const [id, ent] of Object.entries(entitiesRaw)) {
      if (!isPlainObject(ent) || ent.type !== 'assumption') {
        // Every non-assumption entity carries forward untouched.
        nextEntities[id] = ent;
        continue;
      }
      // `Object.hasOwn`, not a truthy `nextAssumptions[id]`: an adversarial /
      // hand-edited id like `"toString"` would otherwise resolve to the inherited
      // Object.prototype method and spread into a malformed record with no `id`.
      const existing = Object.hasOwn(nextAssumptions, id) ? nextAssumptions[id] : undefined;
      if (existing) {
        // Common case — the record was dual-written since v7. Only fill an
        // annotationNumber gap from the entity (records minted by v6→v7 predate
        // the field). The entity itself is dropped (not copied to nextEntities).
        if (existing.annotationNumber === undefined && typeof ent.annotationNumber === 'number') {
          nextAssumptions[id] = { ...existing, annotationNumber: ent.annotationNumber };
        }
        movedIds.add(id);
        continue;
      }
      // No record yet — back-fill one via reverse-walk for the host edge.
      const edgeEntry = Object.entries(edgesRaw).find(
        ([, e]) =>
          isPlainObject(e) && Array.isArray(e.assumptionIds) && e.assumptionIds.includes(id)
      );
      if (!edgeEntry) {
        // Orphan assumption-entity — no host edge AND no record. The user made a
        // standalone "assumption" node via the old palette (assumptions weren't
        // edge-only before this pivot). Post-pivot an assumption can't be an
        // entity, so preserve the content NON-DESTRUCTIVELY by re-typing it to a
        // `note` (the universal free-floating annotation) rather than dropping it.
        nextEntities[id] = { ...ent, type: 'note' };
        continue;
      }
      const now = typeof ent.createdAt === 'number' ? ent.createdAt : Date.now();
      const rec: Record<string, unknown> = {
        id,
        edgeId: edgeEntry[0],
        text: typeof ent.title === 'string' ? ent.title : '',
        status: 'unexamined',
        createdAt: now,
        updatedAt: typeof ent.updatedAt === 'number' ? ent.updatedAt : now,
      };
      if (typeof ent.annotationNumber === 'number') rec.annotationNumber = ent.annotationNumber;
      nextAssumptions[id] = rec;
      movedIds.add(id);
    }

    // Re-anchor comments that pointed at a moved assumption-entity.
    let commentsField: Record<string, unknown> | undefined;
    if (isPlainObject(raw.comments) && movedIds.size > 0) {
      commentsField = {};
      for (const [cid, c] of Object.entries(raw.comments)) {
        if (
          isPlainObject(c) &&
          isPlainObject(c.anchor) &&
          c.anchor.kind === 'entity' &&
          typeof c.anchor.entityId === 'string' &&
          movedIds.has(c.anchor.entityId)
        ) {
          commentsField[cid] = {
            ...c,
            anchor: { kind: 'assumption', assumptionId: c.anchor.entityId },
          };
        } else {
          commentsField[cid] = c;
        }
      }
    }

    return {
      ...raw,
      entities: nextEntities,
      assumptions: nextAssumptions,
      // Only override comments when a rewrite happened; otherwise the `...raw`
      // spread keeps the original map (or its absence) untouched.
      ...(commentsField ? { comments: commentsField } : {}),
      schemaVersion: 10,
    };
  },
};
