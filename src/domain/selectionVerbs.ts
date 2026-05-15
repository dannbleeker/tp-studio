/**
 * Session 95 — Selection-verb registry.
 *
 * Single source of truth for "given this selection shape, which verbs
 * apply." Two consumers today: the new SelectionToolbar (anchored
 * above the selected element) and ContextMenu (the right-click menu).
 * Future selection-aware palette filtering, gesture overlays, and
 * any new selection-anchored surface should consume this registry
 * rather than hardcoding their own branch logic.
 *
 * **Scope intent.** This registry holds the *stable verb subset* —
 * the actions whose presence/absence is determined purely by the
 * selection shape, not by deep doc state. Dynamic items that need
 * the full doc to compute (e.g. "Convert to TypeX" enumerated over
 * the doc's `paletteForDoc`, "Pin/Unpin position", "Spawn EC from
 * this entity") stay in their consuming components — they require
 * more context than this registry's `state -> Verb[]` model
 * naturally accommodates.
 *
 * If a verb needs that depth, add it to the consuming component's
 * inline logic and leave it out of the registry. We accept a small
 * amount of duplication at the dynamic edge rather than warping the
 * registry into a runtime DSL.
 *
 * **Verb ID = palette command ID** wherever a palette command
 * exists. The toolbar/menu calls `commandsById[verb.id].run(state)`.
 * Where no palette command exists yet, the verb carries its own
 * `run` closure. Session 95 chose palette+toolbar parity (Dann's
 * call), so any toolbar-only `run` is a candidate for promotion to
 * the palette once the verb earns its keep.
 */

import type { ContextMenuTarget, DocumentStore, Selection } from '@/store';
import type { LucideIcon } from 'lucide-react';

/**
 * Discriminated union over the kinds of selection contexts a verb
 * registry needs to address. `pane` represents the right-click on
 * empty canvas (no selection); `none` is the resting state with no
 * selection AND no context menu — the toolbar uses this to know it
 * should be hidden.
 */
export type Branch =
  | { kind: 'none' }
  | { kind: 'pane' }
  | { kind: 'single-entity'; id: string }
  | { kind: 'single-edge'; id: string }
  | { kind: 'single-group'; id: string }
  | { kind: 'multi-entities'; ids: string[] }
  | { kind: 'multi-edges'; ids: string[] };

export type Verb = {
  /** Stable id. When a palette command exists, this matches its id;
   *  the consumer can look up `COMMANDS_BY_ID[verb.id]` for the
   *  shortcut hint + canonical run handler. */
  id: string;
  /** Full verb label (palette / context menu / accessibility). */
  label: string;
  /** Optional compact label for the toolbar — toolbar chips have
   *  much less horizontal room than menu rows. Falls back to `label`. */
  shortLabel?: string;
  /** Optional Lucide icon. The toolbar always shows the icon when
   *  set; ContextMenu can choose to honour or ignore it. */
  icon?: LucideIcon;
  /** Renders the verb in destructive (rose) styling. Used for
   *  Delete + similar. */
  destructive?: boolean;
  /** When the verb's behaviour lives in the palette command
   *  catalogue, set this and skip `run`. The consumer dispatches
   *  via the palette command's own `run(state)`. */
  paletteCommandId?: string;
  /** Inline run handler — used when no palette command exists
   *  (yet). Receives the live store state at click time. */
  run?: (state: DocumentStore) => void | Promise<void>;
};

/**
 * Derive the current `Branch` from store state + an optional
 * context-menu target (right-click target overrides selection-based
 * branching — the user is asking "what verbs apply to THIS thing,"
 * which might not be the currently-selected thing).
 *
 * The order of the branches matters:
 *   1. Context target wins when present (right-click intent).
 *   2. Multi-edge / multi-entity selection.
 *   3. Single-edge / single-entity / single-group.
 *   4. Fall through to `none` (toolbar hidden).
 */
export const branchFor = (selection: Selection, contextTarget?: ContextMenuTarget): Branch => {
  // Right-click on empty canvas — pane menu.
  if (contextTarget?.kind === 'pane') return { kind: 'pane' };

  // Right-click on a specific entity/edge — that wins over selection.
  if (contextTarget?.kind === 'entity') {
    return { kind: 'single-entity', id: contextTarget.id };
  }
  if (contextTarget?.kind === 'edge') {
    return { kind: 'single-edge', id: contextTarget.id };
  }

  // Selection-driven branches.
  if (selection.kind === 'entities') {
    if (selection.ids.length === 1) {
      return { kind: 'single-entity', id: selection.ids[0]! };
    }
    if (selection.ids.length > 1) {
      return { kind: 'multi-entities', ids: [...selection.ids] };
    }
  }
  if (selection.kind === 'edges') {
    if (selection.ids.length === 1) {
      return { kind: 'single-edge', id: selection.ids[0]! };
    }
    if (selection.ids.length > 1) {
      return { kind: 'multi-edges', ids: [...selection.ids] };
    }
  }
  if (selection.kind === 'groups' && selection.ids.length === 1) {
    return { kind: 'single-group', id: selection.ids[0]! };
  }

  return { kind: 'none' };
};

/**
 * Return the ordered verb list for the given branch. Verbs reference
 * palette commands by id where one exists; new "toolbar-only" verbs
 * have inline `run` handlers. All verbs that have an inline `run`
 * are candidates for palette promotion in the parity pass below.
 *
 * The state passed in lets the registry surface conditional verbs —
 * e.g. only emitting `ungroup-and` when the selected edges actually
 * carry an `andGroupId`. Stays cheap (O(N) over the selection).
 */
export const verbsForBranch = (branch: Branch, state: DocumentStore): Verb[] => {
  switch (branch.kind) {
    case 'none':
    case 'pane':
      // Pane verbs (Paste, Add entity at cursor) are context-menu
      // specific — they're not toolbar verbs. Returning [] keeps the
      // toolbar hidden on pane right-click.
      return [];

    case 'single-entity':
      return [
        {
          id: 'add-successor',
          label: 'Add child',
          shortLabel: 'Child',
          paletteCommandId: 'add-successor',
        },
        {
          id: 'add-predecessor',
          label: 'Add parent',
          shortLabel: 'Parent',
          paletteCommandId: 'add-predecessor',
        },
        {
          id: 'confirm-delete-selection',
          label: 'Delete',
          destructive: true,
          paletteCommandId: 'confirm-delete-selection',
        },
      ];

    case 'single-edge': {
      const verbs: Verb[] = [
        {
          id: 'reverse-edge',
          label: 'Reverse direction',
          shortLabel: 'Reverse',
          paletteCommandId: 'reverse-edge',
        },
        {
          id: 'splice-into-edge',
          label: 'Splice entity into edge',
          shortLabel: 'Splice',
          paletteCommandId: 'splice-into-edge',
        },
        {
          id: 'confirm-delete-selection',
          label: 'Delete edge',
          destructive: true,
          paletteCommandId: 'confirm-delete-selection',
        },
      ];
      return verbs;
    }

    case 'single-group':
      return [
        {
          id: 'toggle-group-collapsed',
          label: 'Toggle collapsed',
          shortLabel: 'Collapse',
          paletteCommandId: 'toggle-group-collapsed',
        },
        {
          id: 'unhoist',
          label: 'Unhoist',
          paletteCommandId: 'unhoist',
        },
      ];

    case 'multi-entities': {
      const verbs: Verb[] = [
        {
          id: 'group-selected-entities',
          label: 'Group entities',
          shortLabel: 'Group',
          paletteCommandId: 'group-selected-entities',
        },
      ];
      if (branch.ids.length === 2) {
        verbs.push({
          id: 'swap-entities',
          label: 'Swap entities',
          shortLabel: 'Swap',
          paletteCommandId: 'swap-entities',
        });
      }
      verbs.push({
        id: 'confirm-delete-selection',
        label: `Delete ${branch.ids.length} entities`,
        shortLabel: 'Delete',
        destructive: true,
        paletteCommandId: 'confirm-delete-selection',
      });
      return verbs;
    }

    case 'multi-edges': {
      const edges = state.doc.edges;
      const anyAndGrouped = branch.ids.some((id) => edges[id]?.andGroupId);
      const anyOrGrouped = branch.ids.some((id) => edges[id]?.orGroupId);
      const anyXorGrouped = branch.ids.some((id) => edges[id]?.xorGroupId);
      const verbs: Verb[] = [
        {
          id: 'group-and',
          label: 'Group as AND',
          shortLabel: 'AND',
          paletteCommandId: 'group-and',
        },
        {
          id: 'group-or',
          label: 'Group as OR',
          shortLabel: 'OR',
          paletteCommandId: 'group-or',
        },
        {
          id: 'group-xor',
          label: 'Group as XOR',
          shortLabel: 'XOR',
          paletteCommandId: 'group-xor',
        },
      ];
      if (anyAndGrouped) {
        verbs.push({
          id: 'ungroup-and',
          label: 'Ungroup AND',
          paletteCommandId: 'ungroup-and',
        });
      }
      if (anyOrGrouped) {
        verbs.push({
          id: 'ungroup-or',
          label: 'Ungroup OR',
          paletteCommandId: 'ungroup-or',
        });
      }
      if (anyXorGrouped) {
        verbs.push({
          id: 'ungroup-xor',
          label: 'Ungroup XOR',
          paletteCommandId: 'ungroup-xor',
        });
      }
      verbs.push({
        id: 'confirm-delete-selection',
        label: `Delete ${branch.ids.length} edges`,
        shortLabel: 'Delete',
        destructive: true,
        paletteCommandId: 'confirm-delete-selection',
      });
      return verbs;
    }
  }
};
