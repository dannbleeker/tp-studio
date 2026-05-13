// Forward-only schema migration framework. A migration takes a parsed-but-not-yet-
// validated document and bumps its `schemaVersion` by exactly one. `importFromJSON`
// calls `migrateToCurrent` before its strict shape check, so today's importer can
// continue to assume `schemaVersion === CURRENT_SCHEMA_VERSION`.
//
// Today the registry is empty — every saved document already targets v1. The
// framework is here so Phase 3 (groups), Phase 6 (edge labels), and Phase 1 / 13
// (annotation numbers) can land their own migrations without re-inventing the
// loop.

export type SchemaVersion = number;
export type RawDocument = unknown;

export type Migration = {
  fromVersion: SchemaVersion;
  toVersion: SchemaVersion;
  description: string;
  migrate: (doc: RawDocument) => RawDocument;
};

/** Bump this constant when a new migration is registered. */
export const CURRENT_SCHEMA_VERSION: SchemaVersion = 6;

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * v1 → v2: introduce stable per-document annotation numbers and the
 * `nextAnnotationNumber` counter. Walks entities in (createdAt asc, id asc)
 * order and numbers them 1..N. Older docs predate the field; new docs
 * created post-v2 carry it from the start. Also adds the optional
 * `author` / `description` fields on the document (no defaults required).
 */
const v1ToV2: Migration = {
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

/**
 * v2 → v3: introduce the Group system. Adds an empty `groups: {}` map; no
 * existing entity / edge data needs to change. Future docs that contain
 * groups will round-trip through this migration unchanged when re-loaded.
 */
const v2ToV3: Migration = {
  fromVersion: 2,
  toVersion: 3,
  description: 'Add TPDocument.groups (empty map).',
  migrate: (raw) => {
    if (!isPlainObject(raw)) return raw;
    return {
      ...raw,
      groups: isPlainObject(raw.groups) ? raw.groups : {},
      schemaVersion: 3,
    };
  },
};

/**
 * v3 → v4: introduce optional `Edge.label`. No edges need to change shape;
 * the migration is purely a schema-version bump so future readers know how
 * to interpret the field.
 */
const v3ToV4: Migration = {
  fromVersion: 3,
  toVersion: 4,
  description: 'Allow Edge.label (no data shape change).',
  migrate: (raw) => {
    if (!isPlainObject(raw)) return raw;
    return { ...raw, schemaVersion: 4 };
  },
};

/**
 * v4 → v5: introduce optional `Entity.attestation` (Bucket E source /
 * evidence citation) and optional `TPDocument.layoutConfig` (Bundle 4
 * per-doc dagre knobs). Like v3→v4, both are purely additive optional
 * fields — no existing data shape changes. The migration is a version
 * bump so future readers know which fields they can expect.
 */
const v4ToV5: Migration = {
  fromVersion: 4,
  toVersion: 5,
  description: 'Allow Entity.attestation and TPDocument.layoutConfig (no data shape change).',
  migrate: (raw) => {
    if (!isPlainObject(raw)) return raw;
    return { ...raw, schemaVersion: 5 };
  },
};

/**
 * v5 → v6: introduce optional `Entity.attributes` (B7 — user-defined
 * attributes) and optional `TPDocument.customEntityClasses` (B10 —
 * user-defined entity classes). Both are purely additive optional
 * fields — no existing data shape changes. Docs that don't use them
 * round-trip unchanged.
 */
const v5ToV6: Migration = {
  fromVersion: 5,
  toVersion: 6,
  description:
    'Allow Entity.attributes (B7) and TPDocument.customEntityClasses (B10) — no data change.',
  migrate: (raw) => {
    if (!isPlainObject(raw)) return raw;
    return { ...raw, schemaVersion: 6 };
  },
};

/** Production migration registry. Populated in version order. */
export const MIGRATIONS: readonly Migration[] = [v1ToV2, v2ToV3, v3ToV4, v4ToV5, v5ToV6];

const readVersion = (doc: RawDocument): SchemaVersion => {
  if (typeof doc === 'object' && doc !== null && !Array.isArray(doc)) {
    const v = (doc as Record<string, unknown>).schemaVersion;
    if (typeof v === 'number') return v;
  }
  return 1;
};

/**
 * Pure migration loop. Walks `doc` forward through `migrations` until its
 * schemaVersion equals `target`. Exposed (rather than only `migrateToCurrent`)
 * so tests can apply fixture migrations without mutating the global registry.
 */
export const applyMigrations = (
  doc: RawDocument,
  migrations: readonly Migration[],
  target: SchemaVersion
): RawDocument => {
  let current = doc;
  let version = readVersion(current);

  if (version > target) {
    throw new Error(
      `Document schemaVersion ${version} is newer than this app supports (${target}). Update the app.`
    );
  }

  let guard = 0;
  while (version < target) {
    const next = migrations.find((m) => m.fromVersion === version);
    if (!next) {
      throw new Error(
        `No migration registered from schemaVersion ${version}; cannot reach ${target}.`
      );
    }
    current = next.migrate(current);
    version = next.toVersion;
    if (++guard > 100) throw new Error('Migration loop exceeded 100 steps; possible cycle.');
  }

  return current;
};

/** Convenience: apply the production registry to reach CURRENT_SCHEMA_VERSION. */
export const migrateToCurrent = (doc: RawDocument): RawDocument =>
  applyMigrations(doc, MIGRATIONS, CURRENT_SCHEMA_VERSION);
