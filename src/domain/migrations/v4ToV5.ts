import { isPlainObject, type Migration } from './shared';

/**
 * v4 → v5: introduce optional `Entity.attestation` (Bucket E source /
 * evidence citation) and optional `TPDocument.layoutConfig` (Bundle 4
 * per-doc dagre knobs). Like v3→v4, both are purely additive optional
 * fields — no existing data shape changes. The migration is a version
 * bump so future readers know which fields they can expect.
 */
export const v4ToV5: Migration = {
  fromVersion: 4,
  toVersion: 5,
  description: 'Allow Entity.attestation and TPDocument.layoutConfig (no data shape change).',
  migrate: (raw) => {
    if (!isPlainObject(raw)) return raw;
    return { ...raw, schemaVersion: 5 };
  },
};
