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
export const CURRENT_SCHEMA_VERSION: SchemaVersion = 1;

/** Production migration registry. Populated in version order. */
export const MIGRATIONS: readonly Migration[] = [];

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
