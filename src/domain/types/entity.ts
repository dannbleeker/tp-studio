// Session 130 — split from `domain/types.ts`. Entity model: the type
// union, the per-entity rendering options (title size, span-of-control),
// the user-defined-attribute shape, and the `Entity` record itself.

import type { EntityId } from './ids';

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

/**
 * Session 134 — spec major gap #6 (structured half).
 *
 * `EvidenceSource` partitions the five recognisable provenance shapes
 * a practitioner might cite when defending an entity in a TOC tree.
 * The taxonomy is intentionally narrow:
 *
 *   - `observed`     — first-hand observation ("I saw the queue grow").
 *   - `stakeholder`  — an assertion from someone with stake ("the CFO says…").
 *   - `metric`       — a numeric measurement ("p95 = 740 ms").
 *   - `policy`       — a documented rule or constraint ("PCI requires…").
 *   - `assumption`   — explicitly an unproven belief, kept honest by the
 *                      label rather than masquerading as fact.
 *
 * Five buckets matches what the existing book / spec call out and gives
 * the UI a tractable five-way pill chooser. New sources require a
 * deliberate code change so the taxonomy doesn't drift.
 */
export type EvidenceSource = 'observed' | 'stakeholder' | 'metric' | 'policy' | 'assumption';

/**
 * Session 134 — qualitative strength rating for evidence. Three steps
 * is the smallest set that lets a reader sort weak / moderate / strong
 * citations at a glance without forcing pseudo-precision (5-step or
 * percentage scales invite false confidence). The strength is the
 * user's judgement, not derived from anything.
 */
export type EvidenceStrength = 'weak' | 'moderate' | 'strong';

/**
 * Session 134 — first-class evidence item attached to an entity. One
 * entity can carry many; ordering is preserved (append order is the
 * natural reading order). The shape mirrors `Assumption` enough that
 * future UI patterns can share components, but the two are conceptually
 * distinct: an Assumption is about an edge ("we're assuming this
 * sufficiency holds"), an Evidence is about a node ("here's WHY this
 * entity exists / is true").
 *
 *   - `id`          — stable per-entity sub-id (nanoid). Lets the UI
 *                     identify rows for edit / delete without index
 *                     juggling.
 *   - `description` — required free-text body. The "what we have".
 *   - `url`         — optional citation URL.
 *   - `source`      — five-way taxonomy (see {@link EvidenceSource}).
 *   - `strength`    — three-way rating (see {@link EvidenceStrength}).
 *   - `validatedAt` / `validatedBy` — per-evidence audit trail. Distinct
 *     from the entity-level `lastValidatedAt` — that's "I checked this
 *     entity is still true today"; this is "I checked THIS specific
 *     piece of evidence is still standing today."
 *   - `createdAt` / `updatedAt` — millisecond timestamps. `createdAt`
 *     is stable; `updatedAt` bumps on any field edit so the row's
 *     last-modified order can be displayed when needed.
 */
export type EvidenceItem = {
  id: string;
  description: string;
  url?: string;
  source: EvidenceSource;
  strength: EvidenceStrength;
  validatedAt?: number;
  validatedBy?: string;
  createdAt: number;
  updatedAt: number;
};

/**
 * Session 135 — spec major gap #3 Phase 1A: cross-diagram traceability.
 *
 * A reference back to the entity that originally inspired this one,
 * for the canonical TOC chain (UDE → CRT core driver → Cloud conflict
 * → assumptions → injections → FRT desired effects / negative
 * branches → PRT obstacles / milestones → TT actions / owners).
 *
 * The reference is metadata, not a live link — editing the source
 * doesn't auto-propagate to imports. The UI surfaces it as a
 * clickable "imported from <doc> → <entity>" badge so a reader can
 * jump back to the source. Round-trips through JSON export +
 * share-link reload so traceability survives serialization.
 *
 * Both ids are stored as plain strings rather than the branded
 * `DocumentId` / `EntityId` types because:
 *   1. The persistence validator deals in plain strings on the way
 *      in (the brand is the construction-site cast).
 *   2. The referenced doc isn't guaranteed to be open in the
 *      current store — the ref is opaque until a UI affordance
 *      tries to resolve it.
 */
export type ImportedFromRef = {
  /** The source document's `TPDocument.id`. */
  docId: string;
  /** The source entity's `Entity.id` inside that document. */
  entityId: string;
  /**
   * Optional snapshot of the source entity's title at import time.
   * Lets the UI render "imported from CRT-1's 'Customer churn'"
   * even when the source doc isn't open in the current store /
   * isn't reachable. Updates if the user explicitly re-imports;
   * doesn't auto-sync.
   */
  sourceTitle?: string;
  /**
   * Optional ISO-string timestamp of when the import happened.
   * Provenance for audit trails — useful in workshop settings
   * where the chain of derivations matters.
   */
  importedAt?: string;
};

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
  /** Session 134 / spec major gap #6 — entity ownership. Free-form
   *  string naming whoever's accountable for the entity (decision owner,
   *  action assignee, validation owner, etc.). Surfaces as a single-line
   *  text input in the EntityInspector, and feeds the `owner` column of
   *  the risk-register CSV export. The dedicated field replaces the
   *  earlier ad-hoc `attributes.owner.value` path that the risk-register
   *  exporter falls back to for older docs.
   *
   *  Note on scope: the full evidence model from the spec (structured
   *  EvidenceItem array with source / strength / validatedAt / validatedBy)
   *  is deferred to a follow-up — see NEXT_STEPS. This session ships only
   *  the single owner field because that's the smallest unit that
   *  unlocks the risk register and the future collaboration story. */
  owner?: string;
  /** Session 134 / spec major gap #6 — when this entity was last
   *  verified. Unix milliseconds. Surfaces in the EntityInspector as a
   *  read-only "Last validated YYYY-MM-DD by …" label (writable via the
   *  `Mark validated` button which stamps `Date.now()` + the current
   *  `owner` value). Not used by any CLR rule today; serves as an audit
   *  trail for risk-register exports and future collaboration features. */
  lastValidatedAt?: number;
  /** Session 134 / spec major gap #6 (structured half) — first-class
   *  evidence list. The list is the audit trail behind the entity:
   *  citations, measurements, stakeholder claims, policy refs, named
   *  assumptions. Surfaces in the EntityInspector as an editable list
   *  beneath the Owner block; feeds the `evidence` column of the
   *  risk-register CSV export. Omitted (not `[]`) when no evidence
   *  has been recorded, so docs without evidence don't carry an
   *  empty array. See {@link EvidenceItem}. */
  evidence?: EvidenceItem[];
  /** Session 135 / spec major gap #3 Phase 1A — cross-diagram
   *  traceability reference. Records "this entity was originally
   *  imported from another doc's entity," the foundation of the
   *  TOC logic chain across diagram types. Metadata only — editing
   *  the source doesn't auto-propagate to imports; UI affordances
   *  layer on top (Phase 1B/1C). Persisted across JSON export +
   *  share-link reload. See {@link ImportedFromRef}. */
  importedFrom?: ImportedFromRef;
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
