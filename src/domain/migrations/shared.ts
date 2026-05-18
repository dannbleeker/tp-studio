// Session 130 — extracted from `domain/migrations.ts`. Houses the shared
// migration types + `isPlainObject` guard that every per-version migration
// file uses. Each migration is now its own file so the v6→v7 logic
// (the substantive one, with EC slot binding + assumption record
// minting) lives apart from the trivial schemaVersion-bump migrations.

export type SchemaVersion = number;
export type RawDocument = unknown;

export type Migration = {
  fromVersion: SchemaVersion;
  toVersion: SchemaVersion;
  description: string;
  migrate: (doc: RawDocument) => RawDocument;
};

export const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
