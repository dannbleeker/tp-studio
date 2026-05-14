import type { Selection } from '@/store';
import { useDocumentStore } from '@/store';

/**
 * Derive the renderer-friendly shape of the current selection. The
 * `selection` slice models the raw shape — kind + id list — but every
 * inspector consumer needs the same handful of derived booleans and the
 * "single id, if any" shorthand. Centralizing here means the ternary
 * chain that used to live in `Inspector.tsx` lives in one tested helper
 * and the Inspector body becomes a flat dispatch on the shape.
 */
export type SelectionShape = {
  /** Verbatim selection state from the store. */
  selection: Selection;
  /** True when something is selected. Equivalent to `selection.kind !== 'none'`. */
  open: boolean;
  /**
   * The single selected id when exactly one entity or edge is selected.
   * `undefined` otherwise (no selection, multi-selection, etc.). Type-narrows
   * the `Inspector`'s downstream single-target branches.
   */
  singleId: string | undefined;
  /** True when a single id is selected AND it resolves to a group, not an entity. */
  isSingleGroup: boolean;
  /** True when the selection has more than one entry. */
  isMulti: boolean;
  /**
   * Pre-computed header label for the inspector panel — one of
   * `"Entity"`, `"Edge"`, `"Group"`, `"N entities"`, `"N edges"`, or `""`.
   */
  headerLabel: string;
};

export const useSelectionShape = (): SelectionShape => {
  const selection = useDocumentStore((s) => s.selection);

  const open = selection.kind !== 'none';
  const singleId =
    selection.kind !== 'none' && selection.ids.length === 1 ? selection.ids[0] : undefined;
  // Session 85 (#1) — `selection.kind === 'groups'` is the truth now.
  // The previous "isSingleGroup = entities kind + groups[id] exists"
  // detection was a workaround for the missing variant.
  const isSingleGroup = selection.kind === 'groups' && !!singleId;
  const isMulti = selection.kind !== 'none' && !singleId;

  const headerLabel = isMulti
    ? selection.kind === 'entities'
      ? `${selection.ids.length} entities`
      : selection.kind === 'edges'
        ? `${selection.ids.length} edges`
        : `${selection.ids.length} groups`
    : selection.kind === 'groups'
      ? 'Group'
      : selection.kind === 'entities'
        ? 'Entity'
        : selection.kind === 'edges'
          ? 'Edge'
          : '';

  return { selection, open, singleId, isSingleGroup, isMulti, headerLabel };
};
