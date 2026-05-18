import { isPlainObject, type Migration } from './shared';

/**
 * v5 → v6: introduce optional `Entity.attributes` (B7 — user-defined
 * attributes) and optional `TPDocument.customEntityClasses` (B10 —
 * user-defined entity classes). Both are purely additive optional
 * fields — no existing data shape changes. Docs that don't use them
 * round-trip unchanged.
 */
export const v5ToV6: Migration = {
  fromVersion: 5,
  toVersion: 6,
  description:
    'Allow Entity.attributes (B7) and TPDocument.customEntityClasses (B10) — no data change.',
  migrate: (raw) => {
    if (!isPlainObject(raw)) return raw;
    return { ...raw, schemaVersion: 6 };
  },
};
