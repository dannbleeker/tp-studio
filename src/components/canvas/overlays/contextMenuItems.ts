import { runPaletteCommand } from '@/components/command-palette/runPaletteCommand';
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
  // Perf #35 — palette-backed verbs dispatch through the lazy
  // `runPaletteCommand` (resolves the command id at click time) instead
  // of resolving against an eagerly-imported `COMMANDS` array, so the
  // context menu no longer drags the command catalogue into index.
  const paletteCommandId = verb.paletteCommandId;
  const run = paletteCommandId
    ? () => {
        void runPaletteCommand(paletteCommandId);
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
