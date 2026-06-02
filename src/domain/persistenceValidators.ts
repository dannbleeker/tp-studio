import { isEdgeKind, isEntityType, isObject, isStringArray } from './guards';
import { isSafeCssColor } from './safeCss';
import { isSafeHref } from './safeUrl';
import type {
  Assumption,
  AssumptionKind,
  AssumptionStatus,
  AttrValue,
  Comment,
  CommentAnchor,
  CustomEntityClass,
  DocumentId,
  Edge,
  EdgeId,
  Entity,
  EntityId,
  EntityLink,
  EntityState,
  EntityType,
  EvidenceItem,
  EvidenceSource,
  EvidenceStrength,
  Group,
  GroupColor,
  GroupId,
  ImportedFromRef,
  TPDocument,
} from './types';

/**
 * Recursive JSON-shape validators for `TPDocument` and its members. Lives
 * separately from `persistence.ts` so the I/O surface (importFromJSON,
 * loadFromLocalStorage) stays compact and the ~200 lines of "did this
 * field arrive as the expected primitive" guards are isolated.
 *
 * Every validator follows the same contract:
 *   - Takes `(v: unknown, label: string)` — label is a JSON-path
 *     fragment used in error messages so the user sees
 *     `Invalid document: entities["abc"] has no id` instead of a bare
 *     "has no id".
 *   - Throws `Error` on the first invalid field. Validation is
 *     fail-fast; partial documents aren't constructed.
 *   - Returns the narrowed value with branded ids cast in. Callers
 *     receive a `Entity` / `Edge` / `Group` ready to slot into a
 *     `TPDocument`.
 *
 * The single-field utilities (validateLayoutConfig, validateSystemScope,
 * validateMethodChecklist) follow a softer contract: malformed
 * sub-fields are dropped rather than throwing, because losing a
 * preference shouldn't fail the whole document import.
 */

const VALID_GROUP_COLORS: ReadonlySet<GroupColor> = new Set([
  'slate',
  'indigo',
  'emerald',
  'amber',
  'rose',
  'violet',
]);

const invalid = (label: string, why: string): Error =>
  new Error(`Invalid document: ${label} ${why}.`);

// A finite number — rejects NaN / ±Infinity, which pass a bare
// `typeof === 'number'` check and then poison sorts (`a - b`) and break
// geometry/bounds math downstream.
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

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
const validateImportedFromRef = (v: unknown, label: string): ImportedFromRef | undefined => {
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
const validateEntityLinks = (v: unknown, label: string): EntityLink[] | undefined => {
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
const validateEvidenceArray = (v: unknown, label: string): EvidenceItem[] | undefined => {
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
const validateAttributes = (v: unknown, label: string): Record<string, AttrValue> | undefined => {
  if (v === undefined || v === null) return undefined;
  if (!isObject(v)) throw invalid(label, 'must be an object');
  const out: Record<string, AttrValue> = {};
  for (const [k, raw] of Object.entries(v)) {
    out[k] = validateAttrValue(raw, `${label}["${k}"]`);
  }
  return Object.keys(out).length > 0 ? out : undefined;
};

export const validateEntity = (v: unknown, label: string): Entity => {
  if (!isObject(v)) throw invalid(label, 'must be an object');
  if (typeof v.id !== 'string') throw invalid(label, 'has no id');
  if (!isEntityType(v.type)) throw invalid(label, `has invalid type "${String(v.type)}"`);
  if (typeof v.title !== 'string') throw invalid(label, 'has non-string title');
  if (!isFiniteNumber(v.annotationNumber)) {
    throw invalid(label, 'has non-finite annotationNumber');
  }
  if (!isFiniteNumber(v.createdAt)) throw invalid(label, 'has non-finite createdAt');
  if (!isFiniteNumber(v.updatedAt)) throw invalid(label, 'has non-finite updatedAt');
  if (v.description !== undefined && typeof v.description !== 'string') {
    throw invalid(label, 'has non-string description');
  }
  // Confidence is deliberately not a property of TP Studio's entity
  // model — old imports may carry a `confidence` field from earlier
  // schemas; it's dropped here without complaint so a legacy doc
  // still loads, just without the field.
  if (
    v.titleSize !== undefined &&
    v.titleSize !== 'sm' &&
    v.titleSize !== 'md' &&
    v.titleSize !== 'lg'
  ) {
    throw invalid(label, `has invalid titleSize "${String(v.titleSize)}"`);
  }
  if (v.collapsed !== undefined && typeof v.collapsed !== 'boolean') {
    throw invalid(label, 'has non-boolean collapsed');
  }
  if (v.coreProblem !== undefined && typeof v.coreProblem !== 'boolean') {
    throw invalid(label, 'has non-boolean coreProblem');
  }
  if (v.ordering !== undefined && !isFiniteNumber(v.ordering)) {
    throw invalid(label, 'has non-finite ordering');
  }
  let position: { x: number; y: number } | undefined;
  if (v.position !== undefined) {
    if (!isObject(v.position)) throw invalid(label, 'has non-object position');
    if (!isFiniteNumber(v.position.x) || !isFiniteNumber(v.position.y)) {
      throw invalid(label, 'has non-finite position.x / position.y');
    }
    position = { x: v.position.x, y: v.position.y };
  }
  if (v.attestation !== undefined && typeof v.attestation !== 'string') {
    throw invalid(label, 'has non-string attestation');
  }
  // Session 134 / spec major gap #6 — entity-level ownership +
  // last-validated audit timestamp. Round-tripped so JSON exports and
  // share-link reloads carry the same accountability metadata the
  // inspector + risk-register exporter consume.
  if (v.owner !== undefined && typeof v.owner !== 'string') {
    throw invalid(label, 'has non-string owner');
  }
  if (v.lastValidatedAt !== undefined && typeof v.lastValidatedAt !== 'number') {
    throw invalid(label, 'has non-number lastValidatedAt');
  }
  if (v.unspecified !== undefined && typeof v.unspecified !== 'boolean') {
    throw invalid(label, 'has non-boolean unspecified');
  }
  // Session 135 / spec gap #4 Phase 1A — entity-state validation.
  // Strict on the four-valued closed taxonomy; unknown values throw
  // rather than fall back, so a corrupt import surfaces cleanly
  // instead of silently downgrading to a default.
  if (
    v.state !== undefined &&
    v.state !== 'true' &&
    v.state !== 'false' &&
    v.state !== 'unknown' &&
    v.state !== 'disputed'
  ) {
    throw invalid(label, `has invalid state "${String(v.state)}"`);
  }
  if (
    v.spanOfControl !== undefined &&
    v.spanOfControl !== 'control' &&
    v.spanOfControl !== 'influence' &&
    v.spanOfControl !== 'external'
  ) {
    throw invalid(label, `has invalid spanOfControl "${String(v.spanOfControl)}"`);
  }
  // Session 77: optional ecSlot binding.
  const validEcSlots = ['a', 'b', 'c', 'd', 'dPrime'] as const;
  if (v.ecSlot !== undefined && !(validEcSlots as readonly unknown[]).includes(v.ecSlot)) {
    throw invalid(label, `has invalid ecSlot "${String(v.ecSlot)}"`);
  }
  const attributes = validateAttributes(v.attributes, `${label}.attributes`);
  const evidence = validateEvidenceArray(v.evidence, `${label}.evidence`);
  // Session 135 / spec gap #3 Phase 1A — cross-diagram traceability
  // reference. Absent on most entities; round-trips when set.
  const importedFrom = validateImportedFromRef(v.importedFrom, `${label}.importedFrom`);
  const links = validateEntityLinks(v.links, `${label}.links`);
  return {
    id: v.id as EntityId,
    type: v.type,
    title: v.title,
    annotationNumber: v.annotationNumber,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
    ...(typeof v.description === 'string' ? { description: v.description } : {}),
    ...(v.titleSize === 'sm' || v.titleSize === 'md' || v.titleSize === 'lg'
      ? { titleSize: v.titleSize }
      : {}),
    ...(v.collapsed === true ? { collapsed: true as const } : {}),
    ...(v.coreProblem === true ? { coreProblem: true as const } : {}),
    ...(typeof v.ordering === 'number' ? { ordering: v.ordering } : {}),
    ...(position ? { position } : {}),
    ...(typeof v.attestation === 'string' ? { attestation: v.attestation } : {}),
    ...(typeof v.owner === 'string' && v.owner.length > 0 ? { owner: v.owner } : {}),
    ...(typeof v.lastValidatedAt === 'number' ? { lastValidatedAt: v.lastValidatedAt } : {}),
    ...(v.unspecified === true ? { unspecified: true as const } : {}),
    ...(v.spanOfControl === 'control' ||
    v.spanOfControl === 'influence' ||
    v.spanOfControl === 'external'
      ? { spanOfControl: v.spanOfControl }
      : {}),
    ...((validEcSlots as readonly unknown[]).includes(v.ecSlot)
      ? { ecSlot: v.ecSlot as (typeof validEcSlots)[number] }
      : {}),
    ...(attributes ? { attributes } : {}),
    ...(evidence ? { evidence } : {}),
    ...(importedFrom ? { importedFrom } : {}),
    ...(links ? { links } : {}),
    ...(v.state === 'true' || v.state === 'false' || v.state === 'unknown' || v.state === 'disputed'
      ? { state: v.state as EntityState }
      : {}),
  };
};

export const validateEdge = (v: unknown, label: string): Edge => {
  if (!isObject(v)) throw invalid(label, 'must be an object');
  if (typeof v.id !== 'string') throw invalid(label, 'has no id');
  if (typeof v.sourceId !== 'string') throw invalid(label, 'has non-string sourceId');
  if (typeof v.targetId !== 'string') throw invalid(label, 'has non-string targetId');
  if (!isEdgeKind(v.kind)) throw invalid(label, `has invalid kind "${String(v.kind)}"`);
  if (v.andGroupId !== undefined && typeof v.andGroupId !== 'string') {
    throw invalid(label, 'has non-string andGroupId');
  }
  // Bundle 8: OR / XOR junctor groupIds use the same lax-string rule as
  // andGroupId. Cross-kind exclusivity is enforced at the in-memory layer
  // (store actions refuse cross-kind grouping); on import we trim
  // conflicts deterministically — and beats or beats xor when multiple
  // are set on the same edge, so a corrupt import gracefully collapses.
  if (v.orGroupId !== undefined && typeof v.orGroupId !== 'string') {
    throw invalid(label, 'has non-string orGroupId');
  }
  if (v.xorGroupId !== undefined && typeof v.xorGroupId !== 'string') {
    throw invalid(label, 'has non-string xorGroupId');
  }
  if (
    v.weight !== undefined &&
    v.weight !== 'positive' &&
    v.weight !== 'negative' &&
    v.weight !== 'zero'
  ) {
    throw invalid(label, `has invalid weight "${String(v.weight)}"`);
  }
  if (v.assumptionIds !== undefined && !isStringArray(v.assumptionIds)) {
    throw invalid(label, 'has non-string-array assumptionIds');
  }
  if (v.label !== undefined && typeof v.label !== 'string') {
    throw invalid(label, 'has non-string label');
  }
  if (v.description !== undefined && typeof v.description !== 'string') {
    throw invalid(label, 'has non-string description');
  }
  if (v.isBackEdge !== undefined && typeof v.isBackEdge !== 'boolean') {
    throw invalid(label, 'has non-boolean isBackEdge');
  }
  if (v.isMutualExclusion !== undefined && typeof v.isMutualExclusion !== 'boolean') {
    throw invalid(label, 'has non-boolean isMutualExclusion');
  }
  const edgeAttributes = validateAttributes(v.attributes, `${label}.attributes`);
  // Bundle 8: enforce cross-kind exclusivity. AND wins; if AND is set
  // we drop OR + XOR. Otherwise OR wins over XOR. The store actions
  // never produce a conflict, but a hand-edited JSON might.
  const hasAnd = typeof v.andGroupId === 'string';
  const hasOr = !hasAnd && typeof v.orGroupId === 'string';
  const hasXor = !hasAnd && !hasOr && typeof v.xorGroupId === 'string';
  return {
    id: v.id as EdgeId,
    sourceId: v.sourceId as EntityId,
    targetId: v.targetId as EntityId,
    kind: v.kind,
    ...(hasAnd ? { andGroupId: v.andGroupId as string } : {}),
    ...(hasOr ? { orGroupId: v.orGroupId as string } : {}),
    ...(hasXor ? { xorGroupId: v.xorGroupId as string } : {}),
    ...(v.weight === 'positive' || v.weight === 'negative' || v.weight === 'zero'
      ? { weight: v.weight }
      : {}),
    ...(isStringArray(v.assumptionIds) ? { assumptionIds: v.assumptionIds as EntityId[] } : {}),
    ...(typeof v.label === 'string' ? { label: v.label } : {}),
    ...(typeof v.description === 'string' ? { description: v.description } : {}),
    ...(v.isBackEdge === true ? { isBackEdge: true as const } : {}),
    ...(v.isMutualExclusion === true ? { isMutualExclusion: true as const } : {}),
    ...(edgeAttributes ? { attributes: edgeAttributes } : {}),
  };
};

/**
 * Session 77 — Assumption record validator. Strict: status must be one
 * of the four canonical values; unknown values throw rather than fall
 * back, so we catch corrupt imports early. `injectionIds` may be
 * absent / empty / a string array of entity ids.
 */
const ASSUMPTION_STATUSES: readonly AssumptionStatus[] = [
  'unexamined',
  'valid',
  'invalid',
  'challengeable',
];
const isAssumptionStatus = (v: unknown): v is AssumptionStatus =>
  typeof v === 'string' && (ASSUMPTION_STATUSES as readonly string[]).includes(v);

const ASSUMPTION_KINDS: readonly AssumptionKind[] = ['necessary', 'parallel', 'sufficient'];
const isAssumptionKind = (v: unknown): v is AssumptionKind =>
  typeof v === 'string' && (ASSUMPTION_KINDS as readonly string[]).includes(v);

export const validateAssumption = (v: unknown, label: string): Assumption => {
  if (!isObject(v)) throw invalid(label, 'must be an object');
  if (typeof v.id !== 'string') throw invalid(label, 'has no id');
  if (typeof v.edgeId !== 'string') throw invalid(label, 'has no edgeId');
  if (typeof v.text !== 'string') throw invalid(label, 'has non-string text');
  if (!isAssumptionStatus(v.status)) {
    throw invalid(label, `has invalid status "${String(v.status)}"`);
  }
  if (v.kind !== undefined && !isAssumptionKind(v.kind)) {
    throw invalid(label, `has invalid kind "${String(v.kind)}"`);
  }
  if (v.injectionIds !== undefined && !isStringArray(v.injectionIds)) {
    throw invalid(label, 'has non-string-array injectionIds');
  }
  if (v.resolved !== undefined && typeof v.resolved !== 'boolean') {
    throw invalid(label, 'has non-boolean resolved');
  }
  if (v.source !== undefined && v.source !== 'user' && v.source !== 'ai') {
    throw invalid(label, `has invalid source "${String(v.source)}"`);
  }
  if (typeof v.createdAt !== 'number') throw invalid(label, 'has non-number createdAt');
  if (typeof v.updatedAt !== 'number') throw invalid(label, 'has non-number updatedAt');
  return {
    id: v.id,
    edgeId: v.edgeId,
    text: v.text,
    status: v.status,
    ...(isAssumptionKind(v.kind) ? { kind: v.kind } : {}),
    ...(isStringArray(v.injectionIds) && v.injectionIds.length > 0
      ? { injectionIds: v.injectionIds as EntityId[] }
      : {}),
    ...(v.resolved === true ? { resolved: true as const } : {}),
    ...(v.source === 'user' || v.source === 'ai' ? { source: v.source } : {}),
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
};

const isCommentAnchor = (v: unknown): v is CommentAnchor => {
  if (!isObject(v)) return false;
  if (v.kind === 'entity') return typeof v.entityId === 'string';
  if (v.kind === 'edge') return typeof v.edgeId === 'string';
  if (v.kind === 'point') return isFiniteNumber(v.x) && isFiniteNumber(v.y);
  return v.kind === 'document';
};

/**
 * Review-comment validator. Strict on the required fields; the anchor is a
 * three-way discriminated union (entity / edge / document). `body` + `author`
 * are plain strings (rendered as escaped text, so no markup is interpreted).
 * Optional `parentId` (a reply) and `resolved` follow the type-or-omit rule.
 */
export const validateComment = (v: unknown, label: string): Comment => {
  if (!isObject(v)) throw invalid(label, 'must be an object');
  if (typeof v.id !== 'string') throw invalid(label, 'has no id');
  if (!isCommentAnchor(v.anchor)) throw invalid(label, 'has invalid anchor');
  if (typeof v.body !== 'string') throw invalid(label, 'has non-string body');
  if (typeof v.author !== 'string') throw invalid(label, 'has non-string author');
  if (v.parentId !== undefined && typeof v.parentId !== 'string') {
    throw invalid(label, 'has non-string parentId');
  }
  if (v.resolved !== undefined && typeof v.resolved !== 'boolean') {
    throw invalid(label, 'has non-boolean resolved');
  }
  if (!isFiniteNumber(v.createdAt)) throw invalid(label, 'has non-finite createdAt');
  if (!isFiniteNumber(v.updatedAt)) throw invalid(label, 'has non-finite updatedAt');
  // Re-build the anchor so stray extra fields don't ride along on round-trip.
  const anchor: CommentAnchor =
    v.anchor.kind === 'entity'
      ? { kind: 'entity', entityId: v.anchor.entityId }
      : v.anchor.kind === 'edge'
        ? { kind: 'edge', edgeId: v.anchor.edgeId }
        : v.anchor.kind === 'point'
          ? { kind: 'point', x: v.anchor.x, y: v.anchor.y }
          : { kind: 'document' };
  return {
    id: v.id,
    anchor,
    body: v.body,
    author: v.author,
    ...(typeof v.parentId === 'string' && v.parentId.length > 0 ? { parentId: v.parentId } : {}),
    ...(v.resolved === true ? { resolved: true as const } : {}),
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
};

export const validateGroup = (v: unknown, label: string): Group => {
  if (!isObject(v)) throw invalid(label, 'must be an object');
  if (typeof v.id !== 'string') throw invalid(label, 'has no id');
  if (typeof v.title !== 'string') throw invalid(label, 'has non-string title');
  if (typeof v.color !== 'string' || !VALID_GROUP_COLORS.has(v.color as GroupColor)) {
    throw invalid(label, `has invalid color "${String(v.color)}"`);
  }
  if (!isStringArray(v.memberIds)) throw invalid(label, 'has non-string-array memberIds');
  if (typeof v.collapsed !== 'boolean') throw invalid(label, 'has non-boolean collapsed');
  if (v.archived !== undefined && typeof v.archived !== 'boolean') {
    throw invalid(label, 'has non-boolean archived');
  }
  if (typeof v.createdAt !== 'number') throw invalid(label, 'has non-number createdAt');
  if (typeof v.updatedAt !== 'number') throw invalid(label, 'has non-number updatedAt');
  return {
    id: v.id as GroupId,
    title: v.title,
    color: v.color as GroupColor,
    memberIds: v.memberIds,
    collapsed: v.collapsed,
    // Emit-or-omit: only `true` is persisted; unset means "not archived".
    ...(v.archived === true ? { archived: true as const } : {}),
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
};

export const validateRecord = <T>(
  raw: unknown,
  validator: (v: unknown, label: string) => T,
  label: string
): Record<string, T> => {
  if (!isObject(raw)) throw invalid(label, 'must be an object');
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(raw)) {
    // Defense-in-depth (security pass, Session 140): never treat a reserved
    // prototype key as a record entry. A JSON-parsed `{"__proto__": …}` carries
    // `__proto__` as an OWN enumerable key, and `out["__proto__"] = …` would
    // invoke the inherited prototype setter. Reject any record (entities,
    // edges, assumptions, comments, groups, …) carrying such a key — a
    // legitimate id is never `__proto__` / `constructor` / `prototype`.
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') {
      throw invalid(`${label}["${k}"]`, 'reserved key is not allowed');
    }
    out[k] = validator(v, `${label}["${k}"]`);
  }
  return out;
};

// ---- Soft (drop-bad-fields) validators ----------------------------------

const VALID_LAYOUT_DIRECTIONS: ReadonlySet<string> = new Set(['BT', 'TB', 'LR', 'RL']);
const VALID_LAYOUT_ALIGNS: ReadonlySet<string> = new Set(['UL', 'UR', 'DL', 'DR']);

export const validateLayoutConfig = (v: unknown): TPDocument['layoutConfig'] | undefined => {
  if (v === undefined || v === null) return undefined;
  if (!isObject(v)) return undefined;
  const out: NonNullable<TPDocument['layoutConfig']> = {};
  if (typeof v.direction === 'string' && VALID_LAYOUT_DIRECTIONS.has(v.direction)) {
    // Concrete narrow rather than `NonNullable<...>['direction']`
    // which under exactOptionalPropertyTypes still includes
    // `undefined` (the field is optional on the parent).
    out.direction = v.direction as 'BT' | 'TB' | 'LR' | 'RL';
  }
  if (typeof v.nodesep === 'number' && Number.isFinite(v.nodesep) && v.nodesep > 0) {
    out.nodesep = v.nodesep;
  }
  if (typeof v.ranksep === 'number' && Number.isFinite(v.ranksep) && v.ranksep > 0) {
    out.ranksep = v.ranksep;
  }
  if (typeof v.align === 'string' && VALID_LAYOUT_ALIGNS.has(v.align)) {
    // Same concrete narrow as `direction` above.
    out.align = v.align as 'UL' | 'UR' | 'DL' | 'DR';
  }
  return Object.keys(out).length > 0 ? out : undefined;
};

const SYSTEM_SCOPE_KEYS = [
  'goal',
  'necessaryConditions',
  'successMeasures',
  'boundaries',
  'containingSystem',
  'interactingSystems',
  'inputsOutputs',
] as const;

export const validateSystemScope = (v: unknown): TPDocument['systemScope'] | undefined => {
  if (v === undefined || v === null) return undefined;
  if (!isObject(v)) return undefined;
  const out: NonNullable<TPDocument['systemScope']> = {};
  for (const key of SYSTEM_SCOPE_KEYS) {
    const raw = v[key];
    if (typeof raw === 'string' && raw.length > 0) {
      out[key] = raw;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
};

export const validateMethodChecklist = (v: unknown): Record<string, boolean> | undefined => {
  if (v === undefined || v === null) return undefined;
  if (!isObject(v)) return undefined;
  const out: Record<string, boolean> = {};
  for (const key of Object.keys(v)) {
    if (v[key] === true) out[key] = true;
  }
  return Object.keys(out).length > 0 ? out : undefined;
};

/**
 * B10 — validate one CustomEntityClass entry. Soft on optional fields
 * (drops bad ones rather than throwing), strict on the required
 * `id` + `label`. Returns undefined when the entry can't be salvaged
 * — the caller filters those out.
 *
 * `id` slug rule: lowercased, [a-z0-9-]+, at least one character. Must
 * NOT collide with a built-in EntityType id; collisions are dropped
 * (the built-in wins).
 */
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

const validateCustomEntityClass = (v: unknown): CustomEntityClass | undefined => {
  if (!isObject(v)) return undefined;
  const id = typeof v.id === 'string' ? v.id : null;
  const label = typeof v.label === 'string' ? v.label : null;
  if (!id || !label) return undefined;
  if (!SLUG_RE.test(id)) return undefined;
  // A custom class can't shadow a built-in entity type.
  if (isEntityType(id)) return undefined;
  const out: CustomEntityClass = { id, label };
  // Drop a color that isn't a safe CSS color value — an arbitrary string
  // here would be interpolated raw into the HTML export's inline `style`
  // attribute (CSS-injection / external-resource beacon). See `safeCss.ts`.
  if (typeof v.color === 'string' && isSafeCssColor(v.color)) out.color = v.color;
  if (typeof v.hint === 'string' && v.hint.length > 0) out.hint = v.hint;
  // B2: icon name is stored as a plain string; the resolver
  // (`entityTypeMeta.ts → resolveEntityTypeMeta`) maps it through the
  // curated catalogue, falling back to Box for unknown names. We
  // accept any non-empty string here so a doc carrying a future
  // icon name (added in a later version) round-trips intact.
  if (typeof v.icon === 'string' && v.icon.length > 0) out.icon = v.icon;
  if (typeof v.supersetOf === 'string' && isEntityType(v.supersetOf)) {
    out.supersetOf = v.supersetOf as EntityType;
  }
  return out;
};

/**
 * B10 — validate the doc's `customEntityClasses` map. Soft: invalid
 * entries are dropped rather than failing the whole import. Returns
 * undefined when the map is absent / empty after filtering.
 */
export const validateCustomEntityClasses = (
  v: unknown
): Record<string, CustomEntityClass> | undefined => {
  if (v === undefined || v === null) return undefined;
  if (!isObject(v)) return undefined;
  const out: Record<string, CustomEntityClass> = {};
  for (const [key, raw] of Object.entries(v)) {
    const entry = validateCustomEntityClass(raw);
    // The key in the persisted map MUST match the entry's `id`. Drop
    // mismatched keys quietly (corrupt import) rather than silently
    // re-keying.
    if (entry && entry.id === key) out[key] = entry;
  }
  return Object.keys(out).length > 0 ? out : undefined;
};
