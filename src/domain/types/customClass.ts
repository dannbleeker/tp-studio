// Session 130 — split from `domain/types.ts`. B10 user-defined entity
// classes. Imports the `EntityType` union from `entity.ts` for the
// `supersetOf` field's type constraint.

import type { EntityType } from './entity';

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
