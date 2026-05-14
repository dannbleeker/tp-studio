import { isEdgeKind, isEntityType, isObject, isStringArray } from './guards';
import type {
  Assumption,
  AssumptionStatus,
  AttrValue,
  CustomEntityClass,
  Edge,
  EdgeId,
  Entity,
  EntityId,
  EntityType,
  Group,
  GroupColor,
  GroupId,
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
  if (typeof v.annotationNumber !== 'number') {
    throw invalid(label, 'has non-number annotationNumber');
  }
  if (typeof v.createdAt !== 'number') throw invalid(label, 'has non-number createdAt');
  if (typeof v.updatedAt !== 'number') throw invalid(label, 'has non-number updatedAt');
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
  if (v.ordering !== undefined && typeof v.ordering !== 'number') {
    throw invalid(label, 'has non-number ordering');
  }
  let position: { x: number; y: number } | undefined;
  if (v.position !== undefined) {
    if (!isObject(v.position)) throw invalid(label, 'has non-object position');
    if (typeof v.position.x !== 'number' || typeof v.position.y !== 'number') {
      throw invalid(label, 'has non-number position.x / position.y');
    }
    position = { x: v.position.x, y: v.position.y };
  }
  if (v.attestation !== undefined && typeof v.attestation !== 'string') {
    throw invalid(label, 'has non-string attestation');
  }
  if (v.unspecified !== undefined && typeof v.unspecified !== 'boolean') {
    throw invalid(label, 'has non-boolean unspecified');
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
    ...(typeof v.ordering === 'number' ? { ordering: v.ordering } : {}),
    ...(position ? { position } : {}),
    ...(typeof v.attestation === 'string' ? { attestation: v.attestation } : {}),
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

export const validateAssumption = (v: unknown, label: string): Assumption => {
  if (!isObject(v)) throw invalid(label, 'must be an object');
  if (typeof v.id !== 'string') throw invalid(label, 'has no id');
  if (typeof v.edgeId !== 'string') throw invalid(label, 'has no edgeId');
  if (typeof v.text !== 'string') throw invalid(label, 'has non-string text');
  if (!isAssumptionStatus(v.status)) {
    throw invalid(label, `has invalid status "${String(v.status)}"`);
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
    ...(isStringArray(v.injectionIds) && v.injectionIds.length > 0
      ? { injectionIds: v.injectionIds as EntityId[] }
      : {}),
    ...(v.resolved === true ? { resolved: true as const } : {}),
    ...(v.source === 'user' || v.source === 'ai' ? { source: v.source } : {}),
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
  if (typeof v.createdAt !== 'number') throw invalid(label, 'has non-number createdAt');
  if (typeof v.updatedAt !== 'number') throw invalid(label, 'has non-number updatedAt');
  return {
    id: v.id as GroupId,
    title: v.title,
    color: v.color as GroupColor,
    memberIds: v.memberIds,
    collapsed: v.collapsed,
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
    out.direction = v.direction as NonNullable<TPDocument['layoutConfig']>['direction'];
  }
  if (typeof v.nodesep === 'number' && Number.isFinite(v.nodesep) && v.nodesep > 0) {
    out.nodesep = v.nodesep;
  }
  if (typeof v.ranksep === 'number' && Number.isFinite(v.ranksep) && v.ranksep > 0) {
    out.ranksep = v.ranksep;
  }
  if (typeof v.align === 'string' && VALID_LAYOUT_ALIGNS.has(v.align)) {
    out.align = v.align as NonNullable<TPDocument['layoutConfig']>['align'];
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
  if (typeof v.color === 'string' && v.color.length > 0) out.color = v.color;
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
