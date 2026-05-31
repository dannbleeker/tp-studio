import { isPlainObject, type Migration } from './shared';

/**
 * v8 → v9: introduce optional `TPDocument.comments` (review comments).
 * Purely additive optional field — no existing data shape changes. Docs that
 * don't carry the field simply have no comments.
 */
export const v8ToV9: Migration = {
  fromVersion: 8,
  toVersion: 9,
  description: 'Allow TPDocument.comments (review comments) — no data shape change.',
  migrate: (raw) => {
    if (!isPlainObject(raw)) return raw;
    return { ...raw, schemaVersion: 9 };
  },
};
