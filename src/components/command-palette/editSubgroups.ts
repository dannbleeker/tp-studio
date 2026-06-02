/**
 * Session 138 — sub-sections for the palette's `Edit` group.
 *
 * The `Edit` group is by far the largest (43 commands). Typing filters the
 * palette by score (sub-sections don't apply there), but the *unfiltered*
 * list was one long unbroken run. This splits it into labelled sub-headers so
 * a user scanning rather than searching can find a verb by category.
 *
 * Kept as one central map rather than a `subgroup` field on each of the 43
 * command objects — easier to audit + reorder in one place. A coverage test
 * (`tests/components/editSubgroups.test.ts`) fails if any `Edit` command is
 * missing here, so a new/renamed command can't silently fall out of a section.
 */

export const EDIT_SUBGROUP_ORDER = [
  'Clipboard & history',
  'Build',
  'Type',
  'Edges & junctors',
  'Groups',
  'Delete & swap',
] as const;

export type EditSubgroup = (typeof EDIT_SUBGROUP_ORDER)[number];

/** Command id → its `Edit`-group sub-section. */
export const EDIT_SUBGROUP: Record<string, EditSubgroup> = {
  // Clipboard & history
  undo: 'Clipboard & history',
  redo: 'Clipboard & history',
  'copy-selection': 'Clipboard & history',
  'cut-selection': 'Clipboard & history',
  'paste-clipboard': 'Clipboard & history',
  // Build (add nodes)
  'add-successor': 'Build',
  'add-predecessor': 'Build',
  'add-nc-child': 'Build',
  'add-prerequisite-need': 'Build',
  'add-precondition': 'Build',
  'add-io-for-obstacle': 'Build',
  'trim-branch': 'Build',
  // Type (mark / promote entity type)
  'mark-as-ude': 'Type',
  'mark-as-rootcause': 'Type',
  'promote-to-goal': 'Type',
  'mark-as-csf': 'Type',
  'mark-as-action': 'Type',
  'mark-as-outcome': 'Type',
  'mark-as-obstacle': 'Type',
  'mark-as-io': 'Type',
  'mark-core-problem': 'Type',
  // Edges & junctors
  'reverse-edge': 'Edges & junctors',
  'cycle-edge-polarity': 'Edges & junctors',
  'add-assumption-to-edge': 'Edges & junctors',
  'splice-into-edge': 'Edges & junctors',
  'start-edge-from-selection': 'Edges & junctors',
  'complete-edge-to-selection': 'Edges & junctors',
  'start-edge-join-and': 'Edges & junctors',
  'group-and': 'Edges & junctors',
  'ungroup-and': 'Edges & junctors',
  'group-or': 'Edges & junctors',
  'ungroup-or': 'Edges & junctors',
  'group-xor': 'Edges & junctors',
  'ungroup-xor': 'Edges & junctors',
  // Groups
  'group-selected-entities': 'Groups',
  'ungroup-selected': 'Groups',
  'toggle-group-collapsed': 'Groups',
  'hoist-into-group': 'Groups',
  unhoist: 'Groups',
  'archive-selected': 'Groups',
  'toggle-group-archived': 'Groups',
  'cycle-group-color': 'Groups',
  'start-negative-branch': 'Groups',
  // Delete & swap
  'swap-entities': 'Delete & swap',
  'confirm-delete-selection': 'Delete & swap',
};

const subgroupIndex = (id: string): number => {
  const sub = EDIT_SUBGROUP[id];
  return sub ? EDIT_SUBGROUP_ORDER.indexOf(sub) : EDIT_SUBGROUP_ORDER.length;
};

/**
 * Stable-sort `Edit` commands into sub-section order (definition order
 * preserved within a sub-section). Unknown ids sort to the end. Used by the
 * palette to lay the unfiltered `Edit` group out under its sub-headers.
 */
export const sortEditItems = <T extends { id: string }>(items: T[]): T[] =>
  [...items].sort((a, b) => subgroupIndex(a.id) - subgroupIndex(b.id));
