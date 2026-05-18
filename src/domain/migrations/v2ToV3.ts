import { isPlainObject, type Migration } from './shared';

/**
 * v2 → v3: introduce the Group system. Adds an empty `groups: {}` map; no
 * existing entity / edge data needs to change. Future docs that contain
 * groups will round-trip through this migration unchanged when re-loaded.
 */
export const v2ToV3: Migration = {
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
