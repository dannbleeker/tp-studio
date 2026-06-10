import type { CustomEntityClass, DiagramType, EntityType, TPDocument } from './types';

/**
 * Session 135 — extracted from `entityTypeMeta.ts` (file split). The
 * per-diagram palette tables + diagram labels + default-entity-type
 * map are a self-contained "which types belong to which diagram"
 * concern, distinct from the visual meta + resolver that stay in
 * `entityTypeMeta.ts` (which re-exports these so existing import sites
 * are unchanged).
 */

// Goal Tree classes appear in every diagram's inspector palette so users can
// pull a Goal / CSF / Necessary Condition into any tree (a CRT may anchor on a
// goal; an FRT often ties injections back to CSFs). The order keeps the
// tree-native classes first and the Goal Tree classes appended.
const GOAL_TREE_CLASSES: EntityType[] = ['goal', 'criticalSuccessFactor', 'necessaryCondition'];

// FL-ET7: notes are universal across diagram types — they're free-form
// annotation entities that sit outside the causal graph. Surfaced last in
// every palette so they don't crowd the TOC-typed picks.
const UNIVERSAL_ANNOTATION_CLASSES: EntityType[] = ['note'];

// Record-canonical (v10): `'assumption'` is intentionally NOT a palette type.
// An assumption is an edge annotation (a `doc.assumptions` record created via
// the EdgeInspector's AssumptionWell), not a standalone causal node — adding it
// as a node would mint an orphan entity the canvas can't render. A free-floating
// "side claim" is a `note` instead.
export const PALETTE_BY_DIAGRAM: Record<DiagramType, EntityType[]> = {
  crt: ['ude', 'effect', 'rootCause', ...GOAL_TREE_CLASSES, ...UNIVERSAL_ANNOTATION_CLASSES],
  frt: [
    'injection',
    'effect',
    'desiredEffect',
    ...GOAL_TREE_CLASSES,
    ...UNIVERSAL_ANNOTATION_CLASSES,
  ],
  // PRT (A2): the apex `goal` anchors the tree; obstacles and intermediate
  // objectives are the working set.
  prt: ['goal', 'obstacle', 'intermediateObjective', ...UNIVERSAL_ANNOTATION_CLASSES],
  // TT (A3): the sequenced injection plan. An apex `desiredEffect` anchors
  // the outcome; `action`s are the steps; `effect`s capture intermediate
  // states the plan passes through.
  tt: ['action', 'effect', 'desiredEffect', ...UNIVERSAL_ANNOTATION_CLASSES],
  // EC (A1): the five-box conflict. `goal` anchors the common objective;
  // `need` and `want` are the four arms.
  ec: ['goal', 'need', 'want', ...UNIVERSAL_ANNOTATION_CLASSES],
  // FL-DT4 — Strategy & Tactics Tree. Each "node" in S&T is a (Strategy,
  // Tactic) pair. The palette surfaces those facets via the existing TOC
  // entity types: `goal` for strategies (the apex anchors the top-level
  // strategy), `injection` for tactics (the active "how"), `necessaryCondition`
  // for the assumption layers (a tactic's NA / PA / SA are necessary
  // conditions on the strategy), plus `effect` for anything that doesn't fit a
  // slot. Default entity type is `injection` (the "do something" pole).
  st: ['goal', 'injection', 'necessaryCondition', 'effect', ...UNIVERSAL_ANNOTATION_CLASSES],
  // FL-DT5 — Free-form diagram. No TOC scaffolding; the palette is just
  // the universally-applicable types (effect as a neutral box, note as a
  // sticky annotation / side-claim). Custom entity classes appended by
  // `paletteForDoc` give the user their own typology.
  freeform: ['effect', ...UNIVERSAL_ANNOTATION_CLASSES],
  // Session 77 / brief §5 — Goal Tree. Three-layer necessity tree using
  // the existing Goal Tree entity types. Goal at apex, CSFs below,
  // Necessary Conditions nested under CSFs; notes float free.
  goalTree: ['goal', 'criticalSuccessFactor', 'necessaryCondition', 'note'],
  // Session 134 / spec major gap #5 — Negative Branch Reservation. A
  // dual of the FRT: trace forward from an injection to the *undesirable*
  // consequences it might generate, then attach mitigations. Palette
  // mirrors FRT (injection at the bottom, effect / UDE forward, plus
  // universal annotations) — no new entity type is needed because the
  // structural role differs but the building blocks are the same.
  nbr: ['injection', 'effect', 'ude', 'desiredEffect', ...UNIVERSAL_ANNOTATION_CLASSES],
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
  goalTree: 'Goal Tree',
  nbr: 'Negative Branch Reservation',
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
  // Goal Tree: the most likely intent on an empty-canvas double-click
  // is to add a Necessary Condition under an existing CSF or NC.
  goalTree: 'necessaryCondition',
  // NBR: a fresh empty-canvas double-click most likely starts a new
  // UDE in the negative branch (the whole point of the diagram is
  // mapping the bad outcomes).
  nbr: 'ude',
};

export const defaultEntityType = (diagramType: DiagramType): EntityType =>
  DEFAULT_ENTITY_TYPE_BY_DIAGRAM[diagramType];

/**
 * The diagram-specific built-in palette plus any custom classes
 * defined in the doc. Used by the inspector's "Type" picker and the
 * canvas double-click default. Built-ins come first (matching their
 * historical order); custom classes append.
 */
export const paletteForDoc = (doc: {
  diagramType: TPDocument['diagramType'];
  // Session 117 — explicit `| undefined` so call sites that pull
  // `customEntityClasses` from `doc` (where it's optional and may
  // be undefined) can pass it through under
  // exactOptionalPropertyTypes without conditional spreads.
  customEntityClasses?: TPDocument['customEntityClasses'] | undefined;
}): string[] => {
  const builtins = PALETTE_BY_DIAGRAM[doc.diagramType] as string[];
  const custom = doc.customEntityClasses
    ? Object.keys(doc.customEntityClasses).sort((a, b) => a.localeCompare(b))
    : [];
  return [...builtins, ...custom];
};

/**
 * Type-classification predicate: does `entityTypeId` denote the given
 * built-in type, either directly or via a custom class whose `supersetOf`
 * points at it? The single owner of "is this a kind of <builtin>" for
 * validators, exporters and the cached `entitiesOfBuiltin` index. Lives in
 * this dependency-free leaf (not `entityTypeMeta`, which pulls the Lucide
 * icon catalogue) so domain-core modules can import it without dragging
 * icons into their chunk.
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

/**
 * An entity's title for prose surfaces (warning messages, CSV cells), with the
 * shared "(untitled)" fallback for empty / whitespace-only titles. One owner
 * for the literal — validators and exporters previously each inlined it (some
 * without the trim). Suffixed variants ("(untitled objective)" etc.) stay
 * local to their exporters on purpose: the suffix carries meaning there.
 */
export const displayTitle = (e: { title: string }): string => e.title.trim() || '(untitled)';
