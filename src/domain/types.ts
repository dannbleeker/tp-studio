// --- Branded ID types ---
// Pure phantom branding: at runtime these are plain strings. The brand exists
// to let TypeScript catch "I accidentally passed an edge id where an entity
// id was expected" at compile time. Records remain keyed by plain `string`
// so that Object.keys() and external string IDs from React Flow / file
// pickers don't need casts on the way in — values produced by our factory
// functions narrow on the way out.

/**
 * Brand a primitive with a phantom literal-string tag. One pattern instead
 * of four hand-rolled unique-symbol brands; trivially extensible when a
 * future entity type needs its own id (e.g. `Brand<string, 'WorkspaceId'>`).
 */
export type Brand<T, B extends string> = T & { readonly __brand: B };

export type EntityId = Brand<string, 'EntityId'>;
export type EdgeId = Brand<string, 'EdgeId'>;
export type DocumentId = Brand<string, 'DocumentId'>;
export type GroupId = Brand<string, 'GroupId'>;

// --- Domain types ---

export type EntityType =
  | 'ude'
  | 'effect'
  | 'rootCause'
  | 'injection'
  | 'desiredEffect'
  | 'assumption'
  // Goal Tree (A4): used to build IO maps / Necessary-Condition trees. These
  // are valid in any diagram but the palette surfaces them for CRT and FRT.
  | 'goal'
  | 'criticalSuccessFactor'
  | 'necessaryCondition'
  // Prerequisite Tree (A2): obstacles in the way of an ambitious goal, and
  // intermediate objectives that overcome them. Edges read IO → obstacle →
  // goal, bottom-up.
  | 'obstacle'
  | 'intermediateObjective'
  // Transition Tree (A3): the "do this then this then this" sequenced plan
  // entity. Actions carry an optional ordering integer that drives a
  // step-number badge and breaks ties when dagre lays out siblings.
  | 'action'
  // Evaporating Cloud (A1): the two needs and two wants of the classic
  // 5-box conflict. `goal` (from Goal Tree) anchors the common objective;
  // `need` are the two prerequisites for the goal; `want` are the two
  // strategies for satisfying each need, which conflict with each other.
  | 'need'
  | 'want'
  // FL-ET7 (Bundle 7): a free-form annotation entity. Notes are NOT part of
  // the causal graph — they cannot be source or target of an edge, and they
  // sit outside every CLR rule that pattern-matches on causality. Treat like
  // a sticky note pinned next to the diagram. Available in every diagram's
  // palette as a universal annotation type alongside `assumption`.
  | 'note';

/** F3: per-entity title rendering size. Lets practitioners shrink a busy
 *  sub-tree's nodes or enlarge a key entity for emphasis. Default is `md`. */
export type EntityTitleSize = 'sm' | 'md' | 'lg';

/**
 * TOC-reading: a three-valued flag distinguishing what the user can do
 * about a given entity. The book's intro makes this distinction explicit
 * ("things we control vs. influence vs. just observe"), and CRT Step 7
 * asks "have you built down to causes you actually control or influence?"
 *
 *   - `'control'` — the user can directly change this (their own actions,
 *     team's processes, things inside their authority).
 *   - `'influence'` — the user can affect it but not decide it (stakeholders,
 *     adjacent systems, downstream consumers).
 *   - `'external'` — the user can only observe / accept it (weather, market
 *     conditions, hard-coded constraints).
 *
 * A small `'external-root-cause'` CLR rule fires a soft clarity-tier
 * nudge when a root cause is flagged `'external'` — those are rarely the
 * real root and usually mean the user should keep digging.
 */
export type SpanOfControl = 'control' | 'influence' | 'external';

/**
 * B7 — user-defined attributes. A discriminated union of the four
 * canonical primitive shapes a user might want to attach to an entity:
 *   - `string` — free-text values (a URL, a name, a stage name)
 *   - `int`    — integers (a count, a year, an ordering)
 *   - `real`   — floats (a probability, a measurement)
 *   - `bool`   — true/false flags
 *
 * Kept as a tagged union rather than `unknown` so persistence guards can
 * verify the shape and the Inspector UI knows which input to render.
 * The user picks the kind when adding the attribute; once set, the kind
 * is part of the value's identity (changing kind requires deleting and
 * re-adding).
 */
export type AttrValue =
  | { kind: 'string'; value: string }
  | { kind: 'int'; value: number }
  | { kind: 'real'; value: number }
  | { kind: 'bool'; value: boolean };

/** Discriminator for `AttrValue.kind`, exported for UI consumers. */
export type AttrKind = AttrValue['kind'];

export type Entity = {
  id: EntityId;
  type: EntityType;
  title: string;
  /** Stable per-document integer for human references. Assigned at creation
   *  from doc.nextAnnotationNumber and never reused. */
  annotationNumber: number;
  description?: string;
  /** Optional per-entity title size override. Undefined = default ('md'). */
  titleSize?: EntityTitleSize;
  /** F7: per-entity disclosure-triangle collapse. When true, this entity's
   *  transitive downstream entities (followers via outgoing edges) hide from
   *  the canvas; the entity itself remains visible with a "+N" badge. */
  collapsed?: boolean;
  /** A3 (Transition Tree): the step number for sequenced plans. UI only
   *  surfaces this for `action` entities today, but the field is generic so
   *  any entity can carry an integer sort hint for future TT polish. */
  ordering?: number;
  /** Hand-positioned coordinate for diagrams whose `LayoutStrategy` is
   *  `'manual'` (Evaporating Cloud will be the first user). For `'auto'`
   *  diagrams (CRT / FRT / PRT / TT today) the field is ignored — dagre owns
   *  layout there — so persisting a position has no visible effect. The
   *  field exists at the entity level rather than a per-document map so
   *  copy/paste, JSON export, and Flying Logic round-trips carry it
   *  alongside the rest of the entity's data without extra plumbing. */
  position?: { x: number; y: number };
  /** E6 (Bucket E CLR extensions): optional source / evidence citation for
   *  the entity — "where did this come from?" Surfaces as a textarea in the
   *  EntityInspector. Persisted alongside the entity so JSON exports +
   *  Flying Logic round-trips carry the attestation. Not validated by any
   *  CLR rule directly; the field exists so users can document provenance. */
  attestation?: string;
  /** Book-derived (TOC-reading set): three-valued flag distinguishing what
   *  the user can do about this entity — directly control it, indirectly
   *  influence it, or only observe / accept it. Renders as a small icon
   *  next to the entity type label in TPNode. A soft CLR nudge fires when
   *  a root cause carries `'external'` (those are usually not the real
   *  root — the chain should descend further). See {@link SpanOfControl}. */
  spanOfControl?: SpanOfControl;
  /** Book-derived (TOC-reading set): an inarticulate placeholder. The user
   *  knows there's a precondition / condition / cause here but can't yet
   *  name it; flagging the entity as `unspecified` makes the slot real
   *  without forcing premature articulation. Two consequences in the rest
   *  of the system:
   *
   *    1. **`entity-existence`** skips the empty-title check for
   *       unspecified entities — that's the point.
   *    2. **TPNode** renders a HelpCircle glyph and an italic "Unspecified"
   *       placeholder when the title is blank, so the user remembers to
   *       come back and fill it in.
   *
   *  Originally motivated by the book's "unspecified Preconditions in a
   *  TT" device, but the flag is generic — works on any entity in any
   *  diagram type. The user clears the flag once they've articulated the
   *  thing the placeholder stood for. */
  unspecified?: boolean;
  /** Session 77 / brief §4 — explicit Evaporating Cloud slot binding.
   *  Only set on EC entities; identifies which of the canonical five
   *  boxes this entity inhabits. Previously EC slots were encoded
   *  implicitly via seeded coordinates — explicit slot makes EC
   *  semantics portable (e.g. a renderer or exporter can ask "which
   *  one is the objective?" without coordinate inspection). */
  ecSlot?: 'a' | 'b' | 'c' | 'd' | 'dPrime';
  /** B7 — user-defined attributes. Keyed by user-chosen name (max one
   *  per key), valued by a tagged AttrValue. Surfaces in the
   *  EntityInspector as a key/value editor. Use for ad-hoc metadata
   *  the built-in fields don't cover: a citation URL, a vendor name, a
   *  numeric probability, a domain-specific flag. Empty / missing means
   *  no attributes — the field is omitted from JSON on persist when
   *  unset, so docs that don't use attributes don't carry an empty map.
   *  See {@link AttrValue}. */
  attributes?: Record<string, AttrValue>;
  createdAt: number;
  updatedAt: number;
};

/**
 * Edge logical semantics. Session 77 split — until now every edge was
 * implicitly `'sufficiency'` and the diagram type chose the reading word
 * ("because" vs. "in order to"). The brief's v1 model promotes the
 * distinction to a stored field so EC + Goal Tree edges are explicitly
 * necessity-typed regardless of how a reader interprets them.
 *
 *   - `'sufficiency'` — "X exists, therefore Y exists." CRT/FRT/TT edges.
 *   - `'necessity'` — "In order to X, Y must hold." EC + Goal Tree edges.
 *
 * Old saved documents have `Edge.kind === 'sufficiency'` everywhere; the
 * v6→v7 migration looks at the document's diagram type and upgrades EC +
 * Goal Tree edges to `'necessity'`.
 */
export type EdgeKind = 'sufficiency' | 'necessity';

/**
 * Bundle 8 / FL-ED1 — edge polarity. Tags an edge as a positive
 * (default sufficiency), negative (counter-causal — "this CAUSE
 * REDUCES this EFFECT"), or zero (neutral / no-effect) correlation.
 * Metadata only: CLR rules don't change behavior on weight, and the
 * cycle/causality validators continue to treat every edge as a
 * structural link. Exporters round-trip the weight where the target
 * format supports it (Flying Logic carries weight natively).
 *
 * Unset (`undefined`) is the common case and reads as "positive
 * sufficiency" — the existing TOC semantics. Only set this when the
 * user explicitly wants to mark counter-causality.
 */
export type EdgeWeight = 'positive' | 'negative' | 'zero';

export type Edge = {
  id: EdgeId;
  sourceId: EntityId;
  targetId: EntityId;
  kind: EdgeKind;
  andGroupId?: string;
  /** Bundle 8 / FL-ED3 — mutual-exclusion junctor across a set of
   *  edges sharing a target. Same model as `andGroupId`: edges with
   *  the same `xorGroupId` value converge into one labelled "XOR"
   *  junctor circle just below the target. An edge can belong to AT
   *  MOST ONE of `andGroupId` / `orGroupId` / `xorGroupId` — the
   *  store actions enforce this and the JunctorOverlay reads them
   *  one-of-three. */
  xorGroupId?: string;
  /** Bundle 8 / FL-ED4 — explicit OR junctor. Today's implicit model
   *  is "two non-AND-grouped incoming edges = either suffices"; an
   *  explicit OR group makes the alternation visible on the canvas
   *  with its own labelled junctor circle. Same exclusivity rule as
   *  `xorGroupId`. */
  orGroupId?: string;
  /** Bundle 8 / FL-ED1 — see {@link EdgeWeight}. Metadata only. */
  weight?: EdgeWeight;
  assumptionIds?: EntityId[];
  /** Optional short text label rendered mid-edge. ≤30 chars renders inline,
   *  longer wraps as a tooltip. Distinct from assumption entities. */
  label?: string;
  /** Long-form markdown annotation explaining the edge — distinct from the
   *  short `label` (which sits inline on the canvas) and from
   *  `assumptionIds` (which links to standalone Assumption entities).
   *  Surfaces in EdgeInspector as a full MarkdownField; the canvas shows a
   *  small "note" indicator when set. Use for "why this edge holds" prose
   *  that doesn't deserve a separate Assumption entity but is too long for
   *  the label. Round-trips through JSON. */
  description?: string;
  /** Book-derived (TOC-reading set): explicit acknowledgement that this edge
   *  closes a causal loop intentionally. CRTs often contain vicious circles
   *  ("manual intake → opaque categories → worse support → more manual
   *  intake"); FRTs often *design* positive reinforcing loops. The cycle
   *  CLR rule (Session 48's E3) treats every cycle as a defect by default;
   *  flagging an edge as a back-edge tells the rule "yes, the loop is the
   *  point — don't warn me about it again." Visually rendered with a
   *  thicker stroke and a small loop glyph so the loop reads as a feature
   *  rather than a problem. */
  isBackEdge?: boolean;
  /** Book-derived (TOC-reading set): mark an edge as a mutual-exclusion link.
   *  Only meaningful on Evaporating Cloud diagrams, where the diagnostic
   *  *depends* on two Wants being mutually exclusive — the user models the
   *  conflict by drawing an edge between the two `want` entities and
   *  flagging it. Visually rendered with a red stroke + ⊥ glyph; an
   *  EC-specific CLR rule fires when a 2-want EC has no such edge ("is
   *  this really a conflict?"). */
  isMutualExclusion?: boolean;
  /** B1 — user-defined attributes on edges, mirroring `Entity.attributes`.
   *  Same `AttrValue` shape and the same Inspector key/value editor.
   *  Use for ad-hoc edge metadata (a source URL on a citation edge, a
   *  weight on a flow edge) that the built-in `label` / `description` /
   *  `isBackEdge` / `isMutualExclusion` fields don't cover. Omitted from
   *  JSON when unset; see {@link AttrValue}. */
  attributes?: Record<string, AttrValue>;
};

/**
 * Session 77 / brief §4 — first-class Assumption record.
 *
 * Pre-v7, assumptions were `Entity` records with `type: 'assumption'`
 * referenced from `Edge.assumptionIds`. That model worked but couldn't
 * carry per-assumption status or link assumptions to the injections
 * that challenge them. v7 promotes Assumption to its own record type
 * keyed by id with:
 *
 *   - `status: 'unexamined' | 'valid' | 'invalid' | 'challengeable'` —
 *     the lifecycle chip surfaced in the AssumptionWell inspector.
 *   - `injectionIds?: EntityId[]` — many-to-many link to injection
 *     entities that would invalidate this assumption. Marking an
 *     injection "implemented" (on the entity itself) highlights every
 *     assumption it challenges + the corresponding edge in green.
 *   - `resolved?: boolean` — suppresses the missing-assumption prompt
 *     on the parent edge without deleting the assumption record.
 *
 * The `Entity` model's `assumption` type stays around as a back-compat
 * shim: pre-v7 docs migrate by emptying the Entity-side assumptions and
 * creating equivalent Assumption records here.
 */
export type AssumptionStatus = 'unexamined' | 'valid' | 'invalid' | 'challengeable';

/**
 * Assumption IDs share the string space with the assumption-Entity
 * records that shadow them during the v6→v7 migration. Plain `string`
 * rather than a brand — matches the brief's `id: string` shape and
 * lets `doc.assumptions[entityId]` work transparently while both
 * representations coexist.
 */
export type Assumption = {
  id: string;
  /** The edge this assumption sits behind. The edge's
   *  `assumptionIds: EntityId[]` carries the reverse index; IDs in
   *  that list dereference into `doc.assumptions` for status + into
   *  `doc.entities` for the legacy text. */
  edgeId: string;
  text: string;
  status: AssumptionStatus;
  /** Many-to-many to injection entities. Marking an injection
   *  "implemented" (via an attribute on the entity) highlights every
   *  assumption that references it + the corresponding edge in green. */
  injectionIds?: EntityId[];
  /** Suppresses the "missing assumption on edge X" CLR prompt. The
   *  assumption record stays — the user is just saying "I've
   *  considered this, move on." */
  resolved?: boolean;
  /** v1.5 hook: AI-suggested assumptions set `source: 'ai'`. */
  source?: 'user' | 'ai';
  createdAt: number;
  updatedAt: number;
};

export type DiagramType =
  | 'crt'
  | 'frt'
  | 'prt'
  | 'tt'
  | 'ec'
  // Session 77 / brief §5 — Goal Tree (Dettmer's Intermediate Objectives
  // Map). Three-layer necessity-logic tree: Goal at top, 3-5 Critical
  // Success Factors below, Necessary Conditions nested under those.
  // Edges read "in order to {parent}, we must {child}". Uses existing
  // `goal` / `criticalSuccessFactor` / `necessaryCondition` entity types.
  | 'goalTree'
  // Bundle 10 / FL-DT4 — Goldratt's Strategy & Tactics Tree. A hierarchical
  // goal-decomposition tree: each level pairs a Strategy ("what we want at
  // this layer") with a Tactic ("how we achieve it"), broken down recursively
  // into child Strategies. We surface the canonical TOC entity types
  // (`goal` for apex strategies, `injection` for tactics, `necessaryCondition`
  // for the assumption facets, plus `assumption` and `effect` for tree-wide
  // metadata). The "diagram type" is a thin shell — palette + method
  // checklist + label — over the existing entity model.
  | 'st'
  // Bundle 10 / FL-DT5 — Free-form diagram. No TOC type constraints. The
  // palette is just `note` + `effect` + any custom entity classes the
  // user defines per-doc; CLR rules skip everything that pattern-matches
  // on specific built-in types. Useful for argument-mapping, brainstorm
  // boards, dependency sketches that don't fit a TOC pattern.
  | 'freeform';

export type ClrRuleId =
  | 'clarity'
  | 'entity-existence'
  | 'causality-existence'
  | 'cause-sufficiency'
  | 'additional-cause'
  | 'cause-effect-reversal'
  | 'predicted-effect-existence'
  | 'tautology'
  // Bucket E (Session 46) CLR rule extensions:
  | 'indirect-effect'
  | 'cycle'
  // TT-specific (Session 53, "Thinking with Flying Logic" reading):
  | 'complete-step'
  // EC-specific (Session 57, "Thinking with Flying Logic" reading):
  | 'ec-missing-conflict'
  // Mental-model nudge (Session 59, "Thinking with Flying Logic" reading):
  | 'external-root-cause'
  // S&T-specific (Session 76, Bundle 10 follow-up): a tactic without
  // explicit Necessary / Parallel / Sufficiency assumption facets.
  | 'st-tactic-assumptions'
  // EC-specific (Session 77, brief §6): the 5-rule structural +
  // completeness check (empty A, B≡C, B/C only feed A, D/D′ only feed
  // their need, missing assumption per arrow, missing injection).
  | 'ec-completeness';

/**
 * Three-level CLR taxonomy used by Block C's tiered warning view. Each
 * `ValidatorRule` declares which tier it belongs to so `WarningsList` can
 * group rendered warnings under CLARITY / EXISTENCE / SUFFICIENCY headers
 * (matching how TOC practitioners discuss CLR challenges in workshops).
 */
export type ClrTier = 'clarity' | 'existence' | 'sufficiency';

export type WarningTarget = { kind: 'entity'; id: string } | { kind: 'edge'; id: string };

export type Warning = {
  id: string;
  ruleId: ClrRuleId;
  message: string;
  target: WarningTarget;
  resolved: boolean;
  /** Three-level CLR taxonomy (Block C / E5). Stamped by `validate()` from
   *  the rule's tier registration; never set inside individual rule files
   *  (the rule doesn't need to know its own tier — the composition layer
   *  is the source of truth). */
  tier: ClrTier;
};

/**
 * Group palette tones. Fixed set so theme/dark/highContrast can pre-map.
 * No freeform color picker yet.
 */
export type GroupColor = 'slate' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'violet';

/**
 * A logical container for entities (and nested groups). Renders as a shaded
 * rounded rectangle behind its members. `memberIds` is ordered and entries
 * resolve to either an `EntityId` or a `GroupId` — disambiguate by lookup
 * against `doc.entities` / `doc.groups`.
 */
export type Group = {
  id: GroupId;
  title: string;
  color: GroupColor;
  memberIds: string[];
  /** When true, members aren't rendered individually; the group becomes one
   *  big node with a member-count badge. Internal positions are preserved. */
  collapsed: boolean;
  createdAt: number;
  updatedAt: number;
};

/**
 * B10 — user-defined entity class. Lets a user say "my domain has
 * Cause / Effect / Evidence / Belief" with their own colors and labels,
 * rather than being limited to the 14 built-in entity types.
 *
 * Custom classes are scoped to the document (round-trip through JSON
 * carries them, but they don't pollute other docs). The `id` is a
 * user-chosen slug (lowercased, alphanumeric + dash); built-in types
 * own the namespace of their canonical ids ('ude', 'effect', etc.) so
 * a custom class id can't shadow a built-in.
 *
 * `supersetOf` is the most important field for CLR rule compatibility:
 * if a custom class is conceptually a kind of `effect`, marking it
 * `supersetOf: 'effect'` lets the rules that look for effects pick it
 * up too. Unset means the rules ignore the class — fine for purely
 * decorative typology (e.g. "Evidence" entities you draw but don't
 * cause-check).
 */
export type CustomEntityClass = {
  /** User-chosen slug; the entity-class id. Lowercased, [a-z0-9-]+,
   *  may not collide with a built-in EntityType id. */
  id: string;
  /** Human-readable label shown in the palette and Inspector. */
  label: string;
  /** Optional Tailwind class name (or hex string starting with `#`)
   *  for the entity's stripe color. Falls back to a neutral default
   *  when missing — the rendered card stays usable either way. */
  color?: string;
  /** B2 — optional Lucide icon name (e.g. `'Star'`, `'Quote'`). Must
   *  be one of the icons in the CUSTOM_CLASS_ICONS catalogue (see
   *  `entityTypeMeta.ts`); other strings fall back to the generic
   *  `Box` icon. Round-trips through JSON; the catalogue is curated
   *  rather than the full ~1500-icon Lucide set so the picker UI
   *  stays usable and the bundle doesn't bloat. */
  icon?: string;
  /** Optional one-line description shown in the palette tooltip. */
  hint?: string;
  /** When set, this custom class is treated as a "kind of <built-in>"
   *  by validators and palette filtering. E.g. `supersetOf: 'effect'`
   *  makes the entity-existence and clarity rules treat it like an
   *  effect for their purposes. Unset = treated as its own type, only
   *  the structural rules (clarity, entity-existence) still apply. */
  supersetOf?: EntityType;
};

/**
 * Per-document layout knobs (Bundle 4 / B1 / B2 / B-bias). When present,
 * `useGraphPositions` threads these into `computeLayout` for auto-layout
 * diagrams. Manual-layout diagrams (EC) ignore them entirely.
 *
 *   - `direction` — dagre's `rankdir`. CRT/FRT default to `'BT'` (effects
 *     above causes, reading bottom-up). Goal Trees + Strategy Trees often
 *     want `'TB'` (goal at the top). `'LR'` / `'RL'` reorient sideways.
 *   - `nodesep` / `ranksep` — the compactness knobs. Smaller = denser
 *     diagram; larger = more whitespace. Both have sensible bounds in the
 *     UI slider so users can't render an unreadable mess.
 *   - `align` — dagre's `align` bias for nodes with multiple parents.
 *     `'UL'` (upper-left) is the most neutral; `'UR' / 'DL' / 'DR'`
 *     shift the diagonal preference of multi-parent placements.
 *
 * Persisted at the doc level rather than per-app preference because a Goal
 * Tree and a CRT in the same workspace want different orientations. The
 * field is optional — undefined falls back to per-diagram-type defaults.
 */
export type LayoutConfig = {
  direction?: 'BT' | 'TB' | 'LR' | 'RL';
  nodesep?: number;
  ranksep?: number;
  align?: 'UL' | 'UR' | 'DL' | 'DR';
};

/**
 * Book-derived "System Scope" capture — CRT Step 1 in the TOC reading
 * prescribes seven structured questions before any entity is drawn. They
 * generalize across diagram types (every TOC tree benefits from naming
 * its goal, boundaries, and success measures up front), so the fields
 * are universal rather than per-diagram-type. Every field is optional and
 * defaults to undefined; an unfilled scope shouldn't block the user from
 * just sketching.
 */
export type SystemScope = {
  goal?: string;
  necessaryConditions?: string;
  successMeasures?: string;
  boundaries?: string;
  containingSystem?: string;
  interactingSystems?: string;
  inputsOutputs?: string;
};

export type TPDocument = {
  id: DocumentId;
  diagramType: DiagramType;
  title: string;
  author?: string;
  description?: string;
  entities: Record<string, Entity>;
  edges: Record<string, Edge>;
  groups: Record<string, Group>;
  resolvedWarnings: Record<string, true>;
  /** Monotonic counter for assigning Entity.annotationNumber on creation. */
  nextAnnotationNumber: number;
  /** Bundle 4 / B1 / B2 / B-bias: per-document dagre knobs. Optional —
   *  missing means "use the per-diagram defaults." See {@link LayoutConfig}. */
  layoutConfig?: LayoutConfig;
  /** Book-derived "Step 0" capture. See {@link SystemScope}. */
  systemScope?: SystemScope;
  /** Book-derived method checklist. Maps step ids (e.g. `'crt.scope'`) to
   *  the boolean "user has checked this step off" state. Step catalogs per
   *  diagram type live in `domain/methodChecklist.ts` — the canonical set
   *  changes there don't require a schema migration since unknown keys are
   *  ignored on read. */
  methodChecklist?: Record<string, boolean>;
  /** B10 — user-defined entity classes scoped to this document.
   *  Keyed by the class's slug id. Empty / missing means "no custom
   *  classes" — the doc uses only the 14 built-in entity types. See
   *  {@link CustomEntityClass}. */
  customEntityClasses?: Record<string, CustomEntityClass>;
  /** Session 77 / brief §4 — first-class Assumption records. Each
   *  Assumption has its own status, can link to multiple injections,
   *  and persists a per-assumption `resolved` flag separate from the
   *  document-wide `resolvedWarnings` map. Older docs (pre-v7) modeled
   *  assumptions as `Entity` records with `type: 'assumption'` referenced
   *  from `Edge.assumptionIds`; the migration moves them into this map
   *  with `status: 'unexamined'` and preserves the edge↔assumption link.
   *
   *  See {@link Assumption}. Empty / missing means "no assumptions" and
   *  the field is omitted from JSON on persist. */
  assumptions?: Record<string, Assumption>;
  createdAt: number;
  updatedAt: number;
  schemaVersion: 7;
};
