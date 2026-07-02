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
import { type EdgePaletteId, ENTITY_STRIPE_COLOR, NODE_STRIPE_PALETTES } from './tokens';
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
  DIAGRAM_SHORT_LABEL,
  DIAGRAM_TYPE_COLOR,
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
  /**
   * One-line, plain-language meaning of the type — what it IS in TOC terms, in
   * words a newcomer gets. Built-ins only (custom classes omit it). Single source
   * of truth for the Building Blocks rail rows and the type-picker tooltip.
   */
  meaning?: string;
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

/**
 * One-line plain-language meaning per built-in type (see `EntityTypeMeta.meaning`).
 * Read by the Building Blocks rail and the inspector type-picker tooltip — one
 * place to edit the copy.
 */
const MEANINGS: Record<EntityType, string> = {
  ude: 'A symptom you want gone. Start a CRT from 3–5 of these.',
  effect: 'An intermediate consequence in the chain of cause and effect.',
  rootCause: 'A deep driver with nothing causing it above — your leverage point.',
  injection:
    'A change you introduce: the intervention that breaks a conflict or drives a future tree.',
  desiredEffect: 'A positive outcome you want the change to produce.',
  goal: 'The objective the whole tree exists to reach.',
  criticalSuccessFactor: "A must-have condition without which the goal can't be met.",
  necessaryCondition: 'A prerequisite that a higher condition or goal depends on.',
  obstacle: 'A barrier standing between you and an objective.',
  intermediateObjective: 'A stepping-stone you reach by clearing an obstacle.',
  action: 'A concrete step that moves the plan forward.',
  need: 'An underlying requirement each side of a conflict is protecting.',
  want: 'The concrete position one side takes to meet its need.',
  note: 'A sticky annotation. Sits outside the causal graph.',
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
      meaning: MEANINGS[type],
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
  customClasses?: Record<string, CustomEntityClass>,
  // The active app colour palette (`uiSlice.edgePalette`). `'default'` — the
  // implicit value for the ~28 callers that don't pass one — returns the
  // canonical `ENTITY_TYPE_META` unchanged, so nothing shifts until a user
  // selects an accessible palette. Only built-in types are recoloured; custom
  // classes keep their user-chosen colour.
  palette: EdgePaletteId = 'default'
): EntityTypeMeta => {
  // 1. Built-in: cast is safe because the key set of ENTITY_TYPE_META
  //    IS the EntityType union, and `in` proved membership.
  if (typeId in ENTITY_TYPE_META) {
    const base = ENTITY_TYPE_META[typeId as EntityType];
    if (palette === 'default') return base;
    return { ...base, stripeColor: NODE_STRIPE_PALETTES[palette][typeId as EntityType] };
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

// `isOfBuiltin` ("does this entity behave as the given built-in type?") and
// `displayTitle` moved to `entityPalettes.ts` — the dependency-free leaf — so
// domain-core modules (graphCore's `entitiesOfBuiltin`) and exporters can use
// them without pulling this module's Lucide icon catalogue into their chunk.
// Re-exported here to keep `@/domain/entityTypeMeta` the single import surface
// for the existing call sites.
export { displayTitle, isOfBuiltin } from './entityPalettes';
