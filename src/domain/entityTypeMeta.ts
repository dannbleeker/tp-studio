import {
  Activity,
  AlertTriangle,
  Box,
  CheckSquare,
  Flag,
  Hammer,
  Heart,
  HelpCircle,
  type LucideIcon,
  Milestone,
  Mountain,
  Sparkles,
  Sprout,
  Star,
  StickyNote,
  Syringe,
  Zap,
} from 'lucide-react';
import { CUSTOM_CLASS_ICONS, type CustomClassIconName } from './entityTypeIcons';
import { ENTITY_STRIPE_COLOR } from './tokens';
import type { CustomEntityClass, EntityType, TPDocument } from './types';

/**
 * Session 135 — split into three files. The custom-class Lucide icon
 * catalogue moved to `entityTypeIcons.ts`; the per-diagram palette
 * tables + diagram labels + default-type map moved to
 * `entityPalettes.ts`. This file keeps the built-in entity-type meta
 * (label + stripe + icon) and the `resolveEntityTypeMeta` resolver,
 * and re-exports the moved symbols so the ~28 existing import sites
 * (`from '@/domain/entityTypeMeta'`) are unchanged.
 */

export {
  DIAGRAM_TYPE_LABEL,
  defaultEntityType,
  PALETTE_BY_DIAGRAM,
  paletteForDoc,
} from './entityPalettes';
// Re-exports — keep `@/domain/entityTypeMeta` the single import surface.
export { CUSTOM_CLASS_ICONS, type CustomClassIconName } from './entityTypeIcons';

export type EntityTypeMeta = {
  // Session 85 (#1) — widened from `EntityType` to `EntityType | string`
  // so custom-class meta (whose id is a user-defined string outside the
  // built-in union) doesn't need the `as unknown as EntityType` cast.
  // Most consumers only ever read `meta.type` as a string (display label,
  // serialization, css class key) — narrowing to the union was decorative.
  // Cases that need to discriminate built-in vs custom use the runtime
  // check `type in ENTITY_TYPE_META`.
  type: EntityType | string;
  label: string;
  stripeColor: string;
  shortcut?: string;
  /**
   * Per-type icon (Lucide). Rendered next to the type label in TPNode.
   * Block 0.6 added the slot; Block B fills it. The icon is the second
   * visual cue alongside the stripe colour — useful at low zoom and for
   * users who have the high-contrast or colorblind-safe palette on, where
   * stripe colour alone is less reliable.
   */
  icon: LucideIcon;
};

const LABELS: Record<EntityType, string> = {
  ude: 'Undesirable Effect',
  effect: 'Effect',
  rootCause: 'Root Cause',
  injection: 'Injection',
  desiredEffect: 'Desired Effect',
  goal: 'Goal',
  criticalSuccessFactor: 'Critical Success Factor',
  necessaryCondition: 'Necessary Condition',
  obstacle: 'Obstacle',
  intermediateObjective: 'Intermediate Objective',
  action: 'Action',
  need: 'Need',
  want: 'Want',
  note: 'Note',
};

/**
 * Per-type Lucide icon. Picked for semantic clarity over visual prettiness:
 * each glyph reads as the entity's TOC role at a glance, not as decoration.
 *
 *   - `ude` → AlertTriangle: warning, something we don't want.
 *   - `effect` → Activity: a happening; reads as motion + change.
 *   - `rootCause` → Sprout: something that grows downstream effects.
 *   - `injection` → Syringe: literally a TOC "injection" — an intervention.
 *   - `desiredEffect` → Sparkles: a good outcome / desired state.
 *   - `goal` → Flag: aspirational endpoint at the apex of an IO map.
 *   - `criticalSuccessFactor` → Star: must-have, primary supporting condition.
 *   - `necessaryCondition` → CheckSquare: a checkable prerequisite.
 *   - `obstacle` → Mountain: a barrier between IO and goal.
 *   - `intermediateObjective` → Milestone: a stepping-stone in a PRT.
 *   - `action` → Hammer: a do-something step in a TT.
 *   - `need` → Heart: an underlying requirement (EC's middle row).
 *   - `want` → Zap: a strategy / sudden choice (EC's outer row).
 *   - `note` → StickyNote: free-form annotation; not part of the causal graph.
 */
const ICONS: Record<EntityType, LucideIcon> = {
  ude: AlertTriangle,
  effect: Activity,
  rootCause: Sprout,
  injection: Syringe,
  desiredEffect: Sparkles,
  goal: Flag,
  criticalSuccessFactor: Star,
  necessaryCondition: CheckSquare,
  obstacle: Mountain,
  intermediateObjective: Milestone,
  action: Hammer,
  need: Heart,
  want: Zap,
  note: StickyNote,
};

export const ENTITY_TYPE_META: Record<EntityType, EntityTypeMeta> = (
  Object.keys(LABELS) as EntityType[]
).reduce(
  (acc, type) => {
    acc[type] = {
      type,
      label: LABELS[type],
      stripeColor: ENTITY_STRIPE_COLOR[type],
      icon: ICONS[type],
    };
    return acc;
  },
  {} as Record<EntityType, EntityTypeMeta>
);

/**
 * Neutral fallback stripe colour used by custom entity classes that
 * don't set their own `color`. Slate-500 reads well against both the
 * light and dark backgrounds.
 */
const DEFAULT_CUSTOM_STRIPE = '#64748b';

/**
 * B10 — resolve the visual + label metadata for any entity type id,
 * whether built-in or user-defined. The lookup order:
 *
 *   1. Built-in EntityType → return the canonical `ENTITY_TYPE_META[type]`.
 *   2. Match in `doc.customEntityClasses` → synthesize meta from the
 *      class's `label` / `color` / `icon` (Sessions 71 + 76 — picked
 *      from `CUSTOM_CLASS_ICONS`, a curated Lucide-icon catalogue).
 *      The icon is persisted as a string id on the class, resolved to
 *      a Lucide component at render time.
 *   3. Unknown → "Unknown type" placeholder so a doc imported with
 *      a class definition that's since been deleted still renders.
 *
 * The resolver is called from TPNode, the palette, exporters, and any
 * other render path that needs to display an entity's "type". The
 * source of truth for what counts as a built-in stays
 * `ENTITY_TYPE_META`; custom classes are layered on top per-doc.
 */
export const resolveEntityTypeMeta = (
  typeId: string,
  customClasses?: Record<string, CustomEntityClass>
): EntityTypeMeta => {
  // 1. Built-in: cast is safe because the key set of ENTITY_TYPE_META
  //    IS the EntityType union, and `in` proved membership.
  if (typeId in ENTITY_TYPE_META) {
    return ENTITY_TYPE_META[typeId as EntityType];
  }
  // 2. Custom class for the doc.
  const custom = customClasses?.[typeId];
  if (custom) {
    // B2: icon name lookup from the curated catalogue; falls back to
    // the generic Box when missing or referencing an icon we don't
    // ship (e.g. a doc imported with a name added in a later version).
    const icon = (custom.icon && CUSTOM_CLASS_ICONS[custom.icon as CustomClassIconName]) || Box;
    return {
      // We use the typeId as the "type" — downstream consumers treat
      // it as opaque (display only).
      type: typeId,
      label: custom.label,
      stripeColor: custom.color ?? DEFAULT_CUSTOM_STRIPE,
      icon,
    };
  }
  // 3. Unknown — graceful degradation.
  return {
    type: typeId,
    label: typeId,
    stripeColor: DEFAULT_CUSTOM_STRIPE,
    icon: HelpCircle,
  };
};

/**
 * Convenience: resolve meta for an entity given the live document.
 * Use this anywhere the doc reference is already in scope; otherwise
 * call `resolveEntityTypeMeta(type, doc.customEntityClasses)` directly.
 */
export const entityMeta = (typeId: string, doc?: TPDocument): EntityTypeMeta =>
  resolveEntityTypeMeta(typeId, doc?.customEntityClasses);

/**
 * B3 — "Does this entity behave as the given built-in type?" Returns
 * true when the entity's own `type` IS the built-in, or when its
 * `type` is a custom class with `supersetOf` set to the built-in.
 *
 * Use this in CLR rules and other places that pattern-match on
 * built-in entity types so they also fire for the user's custom
 * classes. Custom classes that don't set `supersetOf` are treated as
 * their own type — the rules ignore them, which is the right default
 * for purely decorative typology.
 */
export const isOfBuiltin = (
  entityTypeId: string,
  builtin: EntityType,
  customClasses?: Record<string, CustomEntityClass>
): boolean => {
  if (entityTypeId === builtin) return true;
  const custom = customClasses?.[entityTypeId];
  return custom?.supersetOf === builtin;
};
