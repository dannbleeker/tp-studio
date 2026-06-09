// Session 130 — split from `domain/types.ts`. Assumption model: status
// enum + the `Assumption` record. References `EntityId` for the
// injection back-link.

import type { EntityId } from './ids';

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
 * S&T assumption sub-typing (medium gap, Session 135). The Strategy &
 * Tactics tree distinguishes three roles an assumption can play in the
 * logic of a tactic — mirroring the S&T 5-facet keys
 * (`stNecessaryAssumption` / `stParallelAssumption` /
 * `stSufficiencyAssumption`):
 *
 *   - `'necessary'` — must hold for the cause→effect link to work at
 *     all ("we can only do X *because* this holds").
 *   - `'parallel'` — a condition that holds alongside the change but
 *     isn't itself causal ("while we do X, this is also true").
 *   - `'sufficient'` — what makes the cause *enough* to produce the
 *     effect on its own ("X alone suffices *because* this holds").
 *
 * Optional + diagram-agnostic: unset means "untyped assumption" (the
 * common case on CRT / EC edges where the necessary/parallel/
 * sufficient distinction isn't drawn). Only S&T workflows usually set
 * it, but the field lives on the shared `Assumption` record so any
 * diagram can use it.
 */
export type AssumptionKind = 'necessary' | 'parallel' | 'sufficient';

/**
 * Record-canonical (v10): an assumption is identified solely by this id. It was
 * historically shared with a now-removed assumption-Entity (the two shapes
 * coexisted from v7 until the v9→v10 collapse). Plain `string` rather than a
 * brand — matches the brief's `id: string` shape.
 */
export type Assumption = {
  id: string;
  /** The edge this assumption sits behind — the SOLE attachment link (there is
   *  no `edge.assumptionIds` any more). Per-edge lookups go through
   *  `assumptionsForEdge`; text + status live here on the record, never on an
   *  entity. */
  edgeId: string;
  text: string;
  status: AssumptionStatus;
  /** S&T assumption sub-type (Session 135). Optional — unset means
   *  "untyped". See {@link AssumptionKind}. Persisted across JSON
   *  export + share-link reload; emit-or-omit so untyped assumptions
   *  don't grow a `kind: undefined` field. */
  kind?: AssumptionKind;
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
  /** The annotation counter the assumption was minted with. Record-canonical:
   *  carried on the record so the canvas node can render its "#N" badge without
   *  needing an assumption-Entity. Optional for back-compat with pre-collapse
   *  records (and pre-v10 imports, which the migration backfills). */
  annotationNumber?: number;
  createdAt: number;
  updatedAt: number;
};
