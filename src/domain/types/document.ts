// Session 130 — split from `domain/types.ts`. Top-level document type
// + the LayoutConfig and SystemScope shapes it composes. This is the
// "root" of the domain type graph; every concrete data structure
// referenced by the store ultimately flows back here.

import type { Assumption } from './assumption';
import type { DiagramType } from './clr';
import type { Comment } from './comment';
import type { CustomEntityClass } from './customClass';
import type { Edge } from './edge';
import type { Entity } from './entity';
import type { Group } from './group';
import type { DocumentId } from './ids';

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
  /** Session 83 — set once the System Scope nudge toast has been
   *  surfaced for this doc on CRT load. Prevents the toast from re-
   *  firing every doc swap. Setting it `true` is the implicit dismissal;
   *  the flag is documented in user-facing copy via the toast itself. */
  systemScopeNudgeShown?: boolean;
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
  /** Session 87 / EC PPT comparison item #4 — verbal-style toggle.
   *  Defaults to `'neutral'` (the existing "In order to A, we must B"
   *  reading). When `'twoSided'`, the verbalisation strip swaps the
   *  neutral "we" pronouns for the explicit two-party framing the
   *  BESTSELLER workshop PPT uses — "they want to" on the D-side and
   *  "I want to" on the D′-side — so the conflict reads as a
   *  negotiation. Only meaningful on EC docs; ignored on other
   *  diagram types. Stored on the doc so the choice persists across
   *  reloads. */
  ecVerbalStyle?: 'neutral' | 'twoSided';
  /** Review comments — async, in-document feedback anchored to an entity, an
   *  edge, or the document. Keyed by comment id. Stored in the doc so they
   *  round-trip through JSON export / share-links / the self-contained HTML
   *  export. Empty / missing means "no comments" and the field is omitted from
   *  JSON on persist. See {@link Comment}. */
  comments?: Record<string, Comment>;
  createdAt: number;
  updatedAt: number;
  schemaVersion: 9;
};
