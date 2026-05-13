import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Archive,
  Atom,
  Ban,
  BarChart3,
  Beaker,
  Bell,
  BookOpen,
  Bookmark,
  Box,
  Brain,
  Building,
  Check,
  CheckSquare,
  Clock,
  Cloud,
  Compass,
  Crown,
  Database,
  DollarSign,
  Edit,
  Eye,
  FileText,
  Flag,
  GitBranch,
  Globe,
  GraduationCap,
  Hammer,
  Heart,
  HelpCircle,
  Key,
  Leaf,
  Lightbulb,
  Link2,
  Lock,
  type LucideIcon,
  Mail,
  // Aliased to dodge a shadow of the global `Map` constructor. The
  // catalogue key stays `'Map'` so the JSON wire format and the picker
  // search both still match the Lucide convention.
  Map as MapIcon,
  MapPin,
  MessageSquare,
  Microscope,
  Milestone,
  Mountain,
  Package,
  Pin,
  Quote,
  Rocket,
  Server,
  Shield,
  Smile,
  Sparkles,
  Sprout,
  Star,
  StickyNote,
  Sun,
  Syringe,
  Target,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  User,
  Users,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { ENTITY_STRIPE_COLOR } from './tokens';
import type { CustomEntityClass, DiagramType, EntityType, TPDocument } from './types';

export type EntityTypeMeta = {
  type: EntityType;
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
  assumption: 'Assumption',
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
 *   - `assumption` → HelpCircle: an unverified claim the user is taking on faith.
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
  assumption: HelpCircle,
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

// Goal Tree classes appear in every diagram's inspector palette so users can
// pull a Goal / CSF / Necessary Condition into any tree (a CRT may anchor on a
// goal; an FRT often ties injections back to CSFs). The order keeps the
// tree-native classes first and the Goal Tree classes appended.
const GOAL_TREE_CLASSES: EntityType[] = ['goal', 'criticalSuccessFactor', 'necessaryCondition'];

// FL-ET7: notes are universal across diagram types — they're free-form
// annotation entities that sit outside the causal graph. Surfaced last in
// every palette so they don't crowd the TOC-typed picks.
const UNIVERSAL_ANNOTATION_CLASSES: EntityType[] = ['note'];

export const PALETTE_BY_DIAGRAM: Record<DiagramType, EntityType[]> = {
  crt: [
    'ude',
    'effect',
    'rootCause',
    'assumption',
    ...GOAL_TREE_CLASSES,
    ...UNIVERSAL_ANNOTATION_CLASSES,
  ],
  frt: [
    'injection',
    'effect',
    'desiredEffect',
    'assumption',
    ...GOAL_TREE_CLASSES,
    ...UNIVERSAL_ANNOTATION_CLASSES,
  ],
  // PRT (A2): the apex `goal` anchors the tree; obstacles and intermediate
  // objectives are the working set. Assumptions live on edges as in CRT/FRT.
  prt: ['goal', 'obstacle', 'intermediateObjective', 'assumption', ...UNIVERSAL_ANNOTATION_CLASSES],
  // TT (A3): the sequenced injection plan. An apex `desiredEffect` anchors
  // the outcome; `action`s are the steps; `effect`s capture intermediate
  // states the plan passes through; assumptions live on edges.
  tt: ['action', 'effect', 'desiredEffect', 'assumption', ...UNIVERSAL_ANNOTATION_CLASSES],
  // EC (A1): the five-box conflict. `goal` anchors the common objective;
  // `need` and `want` are the four arms. Assumptions can live on edges as
  // in any other diagram.
  ec: ['goal', 'need', 'want', 'assumption', ...UNIVERSAL_ANNOTATION_CLASSES],
  // FL-DT4 — Strategy & Tactics Tree. Each "node" in S&T is a (Strategy,
  // Tactic) pair plus a triplet of assumptions (Necessary, Parallel,
  // Sufficiency). The palette surfaces those facets via the existing TOC
  // entity types: `goal` for strategies (the apex anchors the top-level
  // strategy), `injection` for tactics (the active "how"), `necessaryCondition`
  // for the assumption layers (a tactic's NA / PA / SA are necessary
  // conditions on the strategy), plus `assumption` and `effect` for
  // anything that doesn't fit a slot. Default entity type is `injection`
  // (= the tactic — the "do something" pole of an S&T node).
  st: [
    'goal',
    'injection',
    'necessaryCondition',
    'effect',
    'assumption',
    ...UNIVERSAL_ANNOTATION_CLASSES,
  ],
  // FL-DT5 — Free-form diagram. No TOC scaffolding; the palette is just
  // the universally-applicable types (effect as a neutral box, note as a
  // sticky annotation, assumption as a side-claim). Custom entity classes
  // appended by `paletteForDoc` give the user their own typology.
  freeform: ['effect', 'assumption', ...UNIVERSAL_ANNOTATION_CLASSES],
};

/**
 * Human-readable label for each diagram type. Single source of truth — add a
 * new diagram type to `DiagramType` and this map together. UI strings never
 * spell out the acronym themselves; they read from here.
 */
export const DIAGRAM_TYPE_LABEL: Record<DiagramType, string> = {
  crt: 'Current Reality Tree',
  frt: 'Future Reality Tree',
  prt: 'Prerequisite Tree',
  tt: 'Transition Tree',
  ec: 'Evaporating Cloud',
  st: 'Strategy & Tactics Tree',
  freeform: 'Freeform Diagram',
};

/**
 * The entity type a fresh canvas seeds when the user double-clicks empty
 * space, or what `createDocument` would seed if it pre-populated entities.
 *
 * The `Record<DiagramType, EntityType>` shape forces the compiler to flag a
 * missing entry when a new diagram type joins the union — the previous
 * if/else fallback would have silently defaulted Evaporating Cloud to
 * `'effect'`, which is the wrong starting point for a 5-box conflict diagram.
 */
const DEFAULT_ENTITY_TYPE_BY_DIAGRAM: Record<DiagramType, EntityType> = {
  crt: 'effect',
  frt: 'effect',
  prt: 'intermediateObjective',
  tt: 'action',
  // EC's blank starts pre-seeded with the 5 boxes (see INITIAL_DOC_BY_DIAGRAM),
  // so this default is only hit if the user double-clicks empty space — most
  // likely intent is "add another need" rather than another box of any
  // particular type.
  ec: 'need',
  // FL-DT4: a fresh empty-canvas double-click most likely starts a new
  // tactic — the active "how" of an S&T node. Users can re-type to goal
  // (apex strategy) or other types from the inspector.
  st: 'injection',
  // FL-DT5: neutral default. The user can re-type to a custom class via
  // the inspector if they've defined one for this doc.
  freeform: 'effect',
};

export const defaultEntityType = (diagramType: DiagramType): EntityType =>
  DEFAULT_ENTITY_TYPE_BY_DIAGRAM[diagramType];

/**
 * Neutral fallback stripe colour used by custom entity classes that
 * don't set their own `color`. Slate-500 reads well against both the
 * light and dark backgrounds.
 */
const DEFAULT_CUSTOM_STRIPE = '#64748b';

/**
 * B2 — curated catalogue of Lucide icons exposed to custom entity
 * classes. We deliberately ship a small set rather than the full
 * ~1500-icon Lucide library so:
 *   - the picker UI is scannable, not a search-required mega-list
 *   - the bundle doesn't bloat with hundreds of unused icon glyphs
 *   - the icon names that ship today round-trip through JSON forever
 *
 * Each entry is keyed by its Lucide PascalCase name (the same string
 * persisted in `CustomEntityClass.icon`). Adding a new icon: import
 * it above, add the entry here. Removing an icon would break any doc
 * that referenced it; the resolver falls back to `Box` for unknown
 * names so it degrades gracefully, but it's still a breaking change
 * to users with that icon in flight.
 */
export const CUSTOM_CLASS_ICONS: Record<string, LucideIcon> = {
  // Session 71 original 17.
  Box,
  Star,
  Flag,
  Heart,
  Quote,
  FileText,
  BookOpen,
  Lightbulb,
  Target,
  Compass,
  Shield,
  Link2,
  Users,
  CheckSquare,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  // Session 76 expansion — ~40 more icons across the common semantic
  // categories users have asked for. Adding any icon here is forward-
  // compatible: documents that reference one of these names will
  // render with the right glyph; older versions still render Box
  // fallback. Don't remove icons once they're in the catalogue.
  Activity,
  AlertCircle,
  Archive,
  Atom,
  Ban,
  BarChart3,
  Beaker,
  Bell,
  Bookmark,
  Brain,
  Building,
  Check,
  Clock,
  Cloud,
  Crown,
  Database,
  DollarSign,
  Edit,
  Eye,
  GitBranch,
  Globe,
  GraduationCap,
  Hammer,
  Key,
  Leaf,
  Lock,
  Mail,
  // Catalogue key preserved as `'Map'` even though the local binding is
  // `MapIcon` (avoiding a global-shadow lint).
  Map: MapIcon,
  MapPin,
  MessageSquare,
  Microscope,
  Package,
  Pin,
  Rocket,
  Server,
  Smile,
  Sun,
  TrendingUp,
  User,
  Wrench,
  X,
};
export type CustomClassIconName = keyof typeof CUSTOM_CLASS_ICONS;
export const CUSTOM_CLASS_ICON_NAMES = Object.keys(CUSTOM_CLASS_ICONS) as CustomClassIconName[];

/**
 * B10 — resolve the visual + label metadata for any entity type id,
 * whether built-in or user-defined. The lookup order:
 *
 *   1. Built-in EntityType → return the canonical `ENTITY_TYPE_META[type]`.
 *   2. Match in `doc.customEntityClasses` → synthesize meta from the
 *      class's `label` / `color`. A generic Box icon stands in until
 *      custom-class icons land (parked).
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
      // it as opaque (display only). Cast through `unknown` because
      // TS doesn't know the custom id isn't in the EntityType union.
      type: typeId as unknown as EntityType,
      label: custom.label,
      stripeColor: custom.color ?? DEFAULT_CUSTOM_STRIPE,
      icon,
    };
  }
  // 3. Unknown — graceful degradation.
  return {
    type: typeId as unknown as EntityType,
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
 * The diagram-specific built-in palette plus any custom classes
 * defined in the doc. Used by the inspector's "Type" picker and the
 * canvas double-click default. Built-ins come first (matching their
 * historical order); custom classes append.
 */
export const paletteForDoc = (doc: TPDocument): string[] => {
  const builtins = PALETTE_BY_DIAGRAM[doc.diagramType] as string[];
  const custom = doc.customEntityClasses
    ? Object.keys(doc.customEntityClasses).sort((a, b) => a.localeCompare(b))
    : [];
  return [...builtins, ...custom];
};

/**
 * For validators / exporters that need to know "what built-in does
 * this custom class behave as?" — returns the `supersetOf` field, or
 * the type itself when it's already a built-in.
 *
 * Used by validators to decide whether a CLR rule applies (e.g. the
 * "effect" rules apply to a custom class with `supersetOf: 'effect'`),
 * and by foreign-format exporters (Mermaid / DOT / Flying Logic) to
 * substitute a known type when emitting `class` declarations.
 */
export const effectiveBuiltinType = (
  typeId: string,
  customClasses?: Record<string, CustomEntityClass>
): EntityType | undefined => {
  if (typeId in ENTITY_TYPE_META) return typeId as EntityType;
  const custom = customClasses?.[typeId];
  return custom?.supersetOf;
};

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
