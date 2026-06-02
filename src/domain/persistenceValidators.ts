import { isEdgeKind, isEntityType, isObject, isStringArray } from './guards';
import {
  validateAttributes,
  validateEntityLinks,
  validateEvidenceArray,
  validateImportedFromRef,
} from './persistenceFieldValidators';
import { invalid, isFiniteNumber } from './persistenceValidatorsShared';
import type {
  Assumption,
  AssumptionKind,
  AssumptionStatus,
  Comment,
  CommentAnchor,
  Edge,
  EdgeId,
  Entity,
  EntityId,
  EntityState,
  Group,
  GroupColor,
  GroupId,
} from './types';

/**
 * Recursive JSON-shape validators for `TPDocument` and its members. Lives
 * separately from `persistence.ts` so the I/O surface (importFromJSON,
 * loadFromLocalStorage) stays compact and the "did this field arrive as the
 * expected primitive" guards are isolated.
 *
 * Session 164 — split into leaf modules to tame the file size, keeping this as
 * the strict *member* validators (entity / edge / assumption / comment / group)
 * + `validateRecord`, and the single import site (`@/domain/persistenceValidators`)
 * for `persistence.ts` + the tests:
 *   - `persistenceValidatorsShared.ts` — the `invalid` / `isFiniteNumber` helpers.
 *   - `persistenceFieldValidators.ts` — the strict entity/edge sub-field
 *     validators (attributes / evidence / importedFrom / links).
 *   - `persistenceValidatorsSoft.ts` — the drop-bad-fields preference validators,
 *     re-exported below.
 *
 * Every strict validator follows the same contract:
 *   - Takes `(v: unknown, label: string)` — label is a JSON-path
 *     fragment used in error messages so the user sees
 *     `Invalid document: entities["abc"] has no id` instead of a bare
 *     "has no id".
 *   - Throws `Error` on the first invalid field. Validation is
 *     fail-fast; partial documents aren't constructed.
 *   - Returns the narrowed value with branded ids cast in. Callers
 *     receive a `Entity` / `Edge` / `Group` ready to slot into a
 *     `TPDocument`.
 */

const VALID_GROUP_COLORS: ReadonlySet<GroupColor> = new Set([
  'slate',
  'indigo',
  'emerald',
  'amber',
  'rose',
  'violet',
]);

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
  // Phase 3 #8 — TT per-step Need + Working Assumption (optional free text).
  if (v.need !== undefined && typeof v.need !== 'string') {
    throw invalid(label, 'has non-string need');
  }
  if (v.workingAssumption !== undefined && typeof v.workingAssumption !== 'string') {
    throw invalid(label, 'has non-string workingAssumption');
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
    ...(typeof v.need === 'string' && v.need.length > 0 ? { need: v.need } : {}),
    ...(typeof v.workingAssumption === 'string' && v.workingAssumption.length > 0
      ? { workingAssumption: v.workingAssumption }
      : {}),
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

// The soft (drop-bad-fields) preference validators moved to their own module
// (Session 164); re-export them so `@/domain/persistenceValidators` stays the
// single import site for `persistence.ts` + the tests.
export {
  validateCustomEntityClasses,
  validateLayoutConfig,
  validateMethodChecklist,
  validateSystemScope,
} from './persistenceValidatorsSoft';
