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
