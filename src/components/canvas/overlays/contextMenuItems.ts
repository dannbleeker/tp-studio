import { hasVerbCommand, runVerbCommand } from '@/components/command-palette/verbCommandRuns';
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
  | { kind: 'header'; label: string }
  /** A row that reveals a nested flyout of (action) items on hover / click.
   *  Used to collapse long inline lists — e.g. the entity "Convert to" type
   *  list — into a single "Convert to ▸" row. Rendered by `ContextMenuList`. */
  | { kind: 'submenu'; label: string; items: MenuItem[] };

/**
 * Bridge a selection-verb registry entry into a ContextMenu row. For
 * verbs that name a palette command, run the palette command's
 * canonical handler so menu + Cmd+K + toolbar dispatch through the
 * same code path. Verbs that carry their own inline `run` (no palette
 * command yet) fall through to that closure.
 */
export const toMenuItem = (verb: Verb): MenuItem => {
  // Perf #35 — resolve the verb's command synchronously via the light
  // `verbCommandRuns` registry (the four files that hold verb-backed
  // commands) instead of the full eager `COMMANDS` catalogue. Same
  // priority as before: a real command wins, else the verb's inline
  // `run`, else a no-op.
  const paletteCommandId = verb.paletteCommandId;
  const run =
    paletteCommandId && hasVerbCommand(paletteCommandId)
      ? () => {
          runVerbCommand(paletteCommandId, useDocumentStore.getState());
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
