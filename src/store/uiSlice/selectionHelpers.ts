import type { Selection } from './types';

/**
 * Session 130 — selection-shape helpers.
 *
 * The `Selection` union (4 variants — `none`, `entities`, `edges`,
 * `groups`) is checked via `if (selection.kind === '...')` patterns at
 * 24+ call sites. Most are single-branch checks; these helpers cover
 * the recurring shapes so new code can express them in one line and
 * `matchSelection` gives a compile-time guarantee that all variants
 * are handled when a new one is added to the union.
 *
 * Existing call sites are deliberately NOT migrated — the `kind ===`
 * pattern is fine where it appears. The helpers are an additive
 * convenience for new code + a safety net (`matchSelection`) for
 * places where exhaustiveness matters.
 */

/**
 * Returns the ids array for any selection. Empty array for `'none'`.
 * Useful where the caller doesn't care which kind is selected, only
 * "what are the selected items."
 */
export const getSelectedIds = (selection: Selection): readonly string[] => {
  if (selection.kind === 'none') return [];
  return selection.ids;
};

/** True when the selection holds exactly one item (any kind). */
export const isSingleSelection = (selection: Selection): boolean =>
  selection.kind !== 'none' && selection.ids.length === 1;

/** True when the selection holds two or more items (any kind). */
export const isMultiSelection = (selection: Selection): boolean =>
  selection.kind !== 'none' && selection.ids.length > 1;

/**
 * Exhaustive pattern-match on a Selection. Every variant must be
 * handled; missing one is a compile-time error. Use this in branches
 * that need behaviour per kind so a future fifth variant on the union
 * surfaces every call site that needs updating.
 *
 * @example
 *   const label = matchSelection(selection, {
 *     none: () => 'No selection',
 *     entities: (s) => `${s.ids.length} entities`,
 *     edges: (s) => `${s.ids.length} edges`,
 *     groups: (s) => `${s.ids.length} groups`,
 *   });
 */
export const matchSelection = <T>(
  selection: Selection,
  handlers: {
    none: () => T;
    entities: (s: Extract<Selection, { kind: 'entities' }>) => T;
    edges: (s: Extract<Selection, { kind: 'edges' }>) => T;
    groups: (s: Extract<Selection, { kind: 'groups' }>) => T;
  }
): T => {
  switch (selection.kind) {
    case 'none':
      return handlers.none();
    case 'entities':
      return handlers.entities(selection);
    case 'edges':
      return handlers.edges(selection);
    case 'groups':
      return handlers.groups(selection);
  }
};
