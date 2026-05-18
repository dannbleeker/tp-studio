import { isPlainObject, type Migration } from './shared';

/**
 * v3 → v4: introduce optional `Edge.label`. No edges need to change shape;
 * the migration is purely a schema-version bump so future readers know how
 * to interpret the field.
 */
export const v3ToV4: Migration = {
  fromVersion: 3,
  toVersion: 4,
  description: 'Allow Edge.label (no data shape change).',
  migrate: (raw) => {
    if (!isPlainObject(raw)) return raw;
    return { ...raw, schemaVersion: 4 };
  },
};
