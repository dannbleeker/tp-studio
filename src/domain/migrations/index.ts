// Forward-only schema migration framework. A migration takes a parsed-but-not-yet-
// validated document and bumps its `schemaVersion` by exactly one. `importFromJSON`
// calls `migrateToCurrent` before its strict shape check, so today's importer can
// continue to assume `schemaVersion === CURRENT_SCHEMA_VERSION`.
//
// Session 130 — split per-version migrations into separate files; this
// barrel re-exports the public surface. The old `domain/migrations.ts`
// became this `domain/migrations/index.ts` so every consumer's
// `import from '@/domain/migrations'` keeps working unchanged.
//
// Adding a new migration: create `vNToVN+1.ts` next to its peers,
// import the new `Migration` here, append it to `MIGRATIONS`, and bump
// `CURRENT_SCHEMA_VERSION` to N+1.

import type { Migration, RawDocument, SchemaVersion } from './shared';
import { v1ToV2 } from './v1ToV2';
import { v2ToV3 } from './v2ToV3';
import { v3ToV4 } from './v3ToV4';
import { v4ToV5 } from './v4ToV5';
import { v5ToV6 } from './v5ToV6';
import { v6ToV7 } from './v6ToV7';
import { v7ToV8 } from './v7ToV8';

export type { Migration, RawDocument, SchemaVersion } from './shared';

/** Bump this constant when a new migration is registered. */
export const CURRENT_SCHEMA_VERSION: SchemaVersion = 8;

/** Production migration registry. Populated in version order. */
export const MIGRATIONS: readonly Migration[] = [
  v1ToV2,
  v2ToV3,
  v3ToV4,
  v4ToV5,
  v5ToV6,
  v6ToV7,
  v7ToV8,
];

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
