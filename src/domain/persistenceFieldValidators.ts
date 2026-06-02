import { isObject } from './guards';
import { invalid } from './persistenceValidatorsShared';
import { isSafeHref } from './safeUrl';
import type {
  AttrValue,
  DocumentId,
  EntityId,
  EntityLink,
  EvidenceItem,
  EvidenceSource,
  EvidenceStrength,
  ImportedFromRef,
} from './types';

/**
 * Strict (throw-on-invalid) field-level validators for the entity / edge sub-
 * objects: attribute maps, evidence items, the imported-from reference, and the
 * cross-doc links array. Used by the member validators in
 * `persistenceValidators.ts` (validateEntity / validateEdge).
 *
 * Split out of `persistenceValidators.ts` (Session 164). Same fail-fast contract
 * — throws `Error` on the first invalid field with a JSON-path `label`.
 */

/**
 * B7 — validate one AttrValue. The tagged union has four kinds, each
 * with a tightly-typed `value` field. We're strict here (throws on
 * unknown kind / wrong value shape) because attribute data is
 * user-supplied and a silently-coerced value would surface much later
 * as a render bug.
 */
const validateAttrValue = (v: unknown, label: string): AttrValue => {
  if (!isObject(v)) throw invalid(label, 'must be an object');
  const kind = v.kind;
  const value = v.value;
  if (kind === 'string') {
    if (typeof value !== 'string') throw invalid(label, 'string attr has non-string value');
    return { kind: 'string', value };
  }
  if (kind === 'int') {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      throw invalid(label, 'int attr has non-integer value');
    }
    return { kind: 'int', value };
  }
  if (kind === 'real') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw invalid(label, 'real attr has non-finite-number value');
    }
    return { kind: 'real', value };
  }
  if (kind === 'bool') {
    if (typeof value !== 'boolean') throw invalid(label, 'bool attr has non-boolean value');
    return { kind: 'bool', value };
  }
  throw invalid(label, `has invalid kind "${String(kind)}"`);
};

/**
 * Session 134 — validate one `EvidenceItem`. The five-way source +
 * three-way strength taxonomies are closed sets; unrecognised values
 * throw rather than fall through, so a corrupt import surfaces clearly
 * rather than silently downgrading to a default. Optional fields
 * (`url`, `validatedAt`, `validatedBy`) follow the type-or-omit rule:
 * present-but-wrong-type throws; absent passes; only well-typed values
 * round-trip.
 */
const EVIDENCE_SOURCES: readonly EvidenceSource[] = [
  'observed',
  'stakeholder',
  'metric',
  'policy',
  'assumption',
];
const EVIDENCE_STRENGTHS: readonly EvidenceStrength[] = ['weak', 'moderate', 'strong'];
const isEvidenceSource = (v: unknown): v is EvidenceSource =>
  typeof v === 'string' && (EVIDENCE_SOURCES as readonly string[]).includes(v);
const isEvidenceStrength = (v: unknown): v is EvidenceStrength =>
  typeof v === 'string' && (EVIDENCE_STRENGTHS as readonly string[]).includes(v);

const validateEvidenceItem = (v: unknown, label: string): EvidenceItem => {
  if (!isObject(v)) throw invalid(label, 'must be an object');
  if (typeof v.id !== 'string') throw invalid(label, 'has no id');
  if (typeof v.description !== 'string') throw invalid(label, 'has non-string description');
  if (!isEvidenceSource(v.source)) {
    throw invalid(label, `has invalid source "${String(v.source)}"`);
  }
  if (!isEvidenceStrength(v.strength)) {
    throw invalid(label, `has invalid strength "${String(v.strength)}"`);
  }
  if (v.url !== undefined && typeof v.url !== 'string') {
    throw invalid(label, 'has non-string url');
  }
  if (v.validatedAt !== undefined && typeof v.validatedAt !== 'number') {
    throw invalid(label, 'has non-number validatedAt');
  }
  if (v.validatedBy !== undefined && typeof v.validatedBy !== 'string') {
    throw invalid(label, 'has non-string validatedBy');
  }
  if (typeof v.createdAt !== 'number') throw invalid(label, 'has non-number createdAt');
  if (typeof v.updatedAt !== 'number') throw invalid(label, 'has non-number updatedAt');
  return {
    id: v.id,
    description: v.description,
    source: v.source,
    strength: v.strength,
    // Drop a citation URL carrying a dangerous scheme (javascript:/data:/…) —
    // it would otherwise render as a clickable `<a href>` and execute in our
    // origin when a malicious imported/shared doc is opened. Keep the rest of
    // the evidence item; only the unsafe link is discarded.
    ...(typeof v.url === 'string' && v.url.length > 0 && isSafeHref(v.url) ? { url: v.url } : {}),
    ...(typeof v.validatedAt === 'number' ? { validatedAt: v.validatedAt } : {}),
    ...(typeof v.validatedBy === 'string' && v.validatedBy.length > 0
      ? { validatedBy: v.validatedBy }
      : {}),
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
};

/**
 * Session 135 — validate an `ImportedFromRef`. Strict on the two
 * required string fields (`docId`, `entityId`); the optional
 * `sourceTitle` + `importedAt` follow the type-or-omit rule.
 * Absent → undefined so entities without an import-ref don't carry
 * the field on round-trip.
 */
export const validateImportedFromRef = (v: unknown, label: string): ImportedFromRef | undefined => {
  if (v === undefined || v === null) return undefined;
  if (!isObject(v)) throw invalid(label, 'must be an object');
  if (typeof v.docId !== 'string' || v.docId.length === 0) {
    throw invalid(label, 'has missing or non-string docId');
  }
  if (typeof v.entityId !== 'string' || v.entityId.length === 0) {
    throw invalid(label, 'has missing or non-string entityId');
  }
  if (v.sourceTitle !== undefined && typeof v.sourceTitle !== 'string') {
    throw invalid(label, 'has non-string sourceTitle');
  }
  if (v.importedAt !== undefined && typeof v.importedAt !== 'string') {
    throw invalid(label, 'has non-string importedAt');
  }
  return {
    // Session 137 — Batch 1 tightened the field types to the branded
    // `DocumentId` / `EntityId`. Validator-emitted values are
    // structurally valid id strings; the `as` cast affirms the brand
    // at the trust boundary.
    docId: v.docId as DocumentId,
    entityId: v.entityId as EntityId,
    ...(typeof v.sourceTitle === 'string' && v.sourceTitle.length > 0
      ? { sourceTitle: v.sourceTitle }
      : {}),
    ...(typeof v.importedAt === 'string' && v.importedAt.length > 0
      ? { importedAt: v.importedAt }
      : {}),
  };
};

/**
 * Phase 2a — validate the `links` array (navigable cross-doc references). Each
 * entry needs the two id strings; a malformed entry is dropped (rather than
 * failing the whole import) so a partially-corrupt link list still loads what's
 * valid — links are navigation metadata, not load-bearing structure. Empty /
 * absent → undefined.
 */
export const validateEntityLinks = (v: unknown, label: string): EntityLink[] | undefined => {
  if (v === undefined || v === null) return undefined;
  if (!Array.isArray(v)) throw invalid(label, 'must be an array');
  const out: EntityLink[] = [];
  for (const raw of v) {
    if (!isObject(raw)) continue;
    if (typeof raw.docId !== 'string' || raw.docId.length === 0) continue;
    if (typeof raw.entityId !== 'string' || raw.entityId.length === 0) continue;
    out.push({ docId: raw.docId as DocumentId, entityId: raw.entityId as EntityId });
  }
  return out.length > 0 ? out : undefined;
};

/**
 * Session 134 — validate the `evidence` array on an entity. Strict per
 * item (see {@link validateEvidenceItem}). Empty / absent → undefined
 * so entities without evidence don't carry an empty array on round-trip.
 */
export const validateEvidenceArray = (v: unknown, label: string): EvidenceItem[] | undefined => {
  if (v === undefined || v === null) return undefined;
  if (!Array.isArray(v)) throw invalid(label, 'must be an array');
  if (v.length === 0) return undefined;
  return v.map((item, i) => validateEvidenceItem(item, `${label}[${i}]`));
};

/**
 * B7 — validate the `attributes` map on an entity. Strict: any
 * invalid value throws (with the offending key in the label). Returns
 * undefined when the input is absent or empty — entities without
 * attributes don't carry an empty map.
 */
export const validateAttributes = (
  v: unknown,
  label: string
): Record<string, AttrValue> | undefined => {
  if (v === undefined || v === null) return undefined;
  if (!isObject(v)) throw invalid(label, 'must be an object');
  const out: Record<string, AttrValue> = {};
  for (const [k, raw] of Object.entries(v)) {
    out[k] = validateAttrValue(raw, `${label}["${k}"]`);
  }
  return Object.keys(out).length > 0 ? out : undefined;
};
