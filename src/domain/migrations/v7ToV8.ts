import { isPlainObject, type Migration } from './shared';

/**
 * v7 → v8: introduce optional `TPDocument.ecVerbalStyle` (Session 87 /
 * EC PPT comparison item #4 — two-sided "I want / they want" framing).
 * Purely additive optional field — no existing data shape changes. Docs
 * that don't carry the field default to `'neutral'` at the
 * verbalisation layer, matching the v7 behavior.
 */
export const v7ToV8: Migration = {
  fromVersion: 7,
  toVersion: 8,
  description: 'Allow TPDocument.ecVerbalStyle (Session 87) — no data shape change.',
  migrate: (raw) => {
    if (!isPlainObject(raw)) return raw;
    return { ...raw, schemaVersion: 8 };
  },
};
