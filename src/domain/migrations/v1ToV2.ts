import { isPlainObject, type Migration } from './shared';

/**
 * v1 → v2: introduce stable per-document annotation numbers and the
 * `nextAnnotationNumber` counter. Walks entities in (createdAt asc, id asc)
 * order and numbers them 1..N. Older docs predate the field; new docs
 * created post-v2 carry it from the start. Also adds the optional
 * `author` / `description` fields on the document (no defaults required).
 */
export const v1ToV2: Migration = {
  fromVersion: 1,
  toVersion: 2,
  description: 'Assign Entity.annotationNumber, add TPDocument.nextAnnotationNumber.',
  migrate: (raw) => {
    if (!isPlainObject(raw)) return raw;
    const entitiesRaw = isPlainObject(raw.entities) ? raw.entities : {};
    const entries = Object.entries(entitiesRaw).filter(
      (entry): entry is [string, Record<string, unknown>] => isPlainObject(entry[1])
    );
    // Order numbers by createdAt then id so the assignment is deterministic
    // for any given input doc.
    entries.sort(([aId, a], [bId, b]) => {
      const aCreated = typeof a.createdAt === 'number' ? a.createdAt : 0;
      const bCreated = typeof b.createdAt === 'number' ? b.createdAt : 0;
      if (aCreated !== bCreated) return aCreated - bCreated;
      return aId < bId ? -1 : aId > bId ? 1 : 0;
    });
    const nextEntities: Record<string, Record<string, unknown>> = {};
    let n = 0;
    for (const [id, entity] of entries) {
      n += 1;
      nextEntities[id] = { ...entity, annotationNumber: n };
    }
    return {
      ...raw,
      entities: nextEntities,
      nextAnnotationNumber: n + 1,
      schemaVersion: 2,
    };
  },
};
