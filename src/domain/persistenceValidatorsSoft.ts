import { isEntityType, isObject } from './guards';
import { isSafeCssColor } from './safeCss';
import type { CustomEntityClass, EntityType, TPDocument } from './types';

/**
 * Soft (drop-bad-fields) persistence validators — the preference / metadata
 * fields where a malformed sub-field is dropped rather than throwing, because
 * losing a preference shouldn't fail the whole document import: layout config,
 * system scope, the method checklist, and the custom entity classes.
 *
 * Split out of `persistenceValidators.ts` (Session 164). Re-exported from
 * `persistenceValidators.ts` so `@/domain/persistenceValidators` stays the
 * single import site for `persistence.ts` + the tests.
 */

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
