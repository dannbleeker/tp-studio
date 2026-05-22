import { COMMANDS } from '@/components/command-palette/commands';
import { type Branch, type Verb, verbsForBranch } from '@/domain/selectionVerbs';
import { useDocumentStore } from '@/store';

/**
 * Session 135 — extracted from `ContextMenu.tsx` (file split). The
 * `MenuItem` shape + the two registry-bridging helpers
 * (`toMenuItem`, `leadingVerbItems`) are self-contained — no component
 * closure — so they live here, leaving `ContextMenu.tsx` to own the
 * per-branch item assembly + the dynamic per-doc rows. The
 * presentational render moved to `ContextMenuList.tsx`.
 */
export type MenuItem =
  | { kind: 'action'; label: string; destructive?: boolean; run: () => void }
  | { kind: 'separator' }
  | { kind: 'header'; label: string };

/**
 * Bridge a selection-verb registry entry into a ContextMenu row. For
 * verbs that name a palette command, run the palette command's
 * canonical handler so menu + Cmd+K + toolbar dispatch through the
 * same code path. Verbs that carry their own inline `run` (no palette
 * command yet) fall through to that closure.
 */
export const toMenuItem = (verb: Verb): MenuItem => {
  const command = verb.paletteCommandId
    ? COMMANDS.find((c) => c.id === verb.paletteCommandId)
    : undefined;
  const run = command
    ? () => {
        void command.run(useDocumentStore.getState());
      }
    : verb.run
      ? () => {
          void verb.run?.(useDocumentStore.getState());
        }
      : () => {};
  return {
    kind: 'action',
    label: verb.label,
    // Conditional spread to avoid passing `destructive: undefined`
    // (exactOptionalPropertyTypes rejects the explicit undefined on
    // the optional `MenuItem.destructive?: boolean` field).
    ...(verb.destructive !== undefined ? { destructive: verb.destructive } : {}),
    run,
  };
};

/**
 * Non-destructive leading verbs for a branch. The menu keeps its own
 * destructive-delete row inline because the labels differ from the
 * registry's defaults (e.g. "Delete entity" vs "Delete") and the
 * trailing separator before delete is part of the menu's UX rhythm.
 */
export const leadingVerbItems = (branch: Branch): MenuItem[] => {
  const verbs = verbsForBranch(branch, useDocumentStore.getState()).filter((v) => !v.destructive);
  return verbs.map(toMenuItem);
};
