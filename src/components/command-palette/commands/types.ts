import { guardWriteOrToast } from '@/services/browseLock';
import type { DocumentStore } from '@/store';

/**
 * One command in the palette. `group` drives the section headers the
 * palette renders when no query is active (when filtering, results sort
 * by score and headers are suppressed so the top match is always at the
 * top). The kbd hint shown next to the label comes from the shortcut
 * registry — the palette renderer looks up `SHORTCUT_BY_ID[cmd.id]?.keys`,
 * so a command's `id` matches the corresponding shortcut entry when there
 * is one (e.g. `id: 'undo'` → registry shows `Ctrl+Z` / `⌘+Z`). The actual
 * key binding lives in `useGlobalKeyboard`.
 *
 * Groups follow user mental model rather than file-of-origin:
 *
 *   - **`'File'`** — bring docs in (new, load example, import, quick capture).
 *   - **`'Edit'`** — every mutation: undo/redo, clipboard, swap, reverse,
 *     AND-grouping, entity-grouping, hoist.
 *   - **`'View'`** — viewport / selection navigation, plus display prefs
 *     (theme, browse lock, settings).
 *   - **`'Review'`** — inspect / validate / history / metadata.
 *   - **`'Export'`** — send the doc somewhere (JSON / CSV / images / PDF).
 *   - **`'Help'`** — learn the app.
 *
 * Files under `commands/` are still organized by domain (edges.ts, groups.ts,
 * etc.) — the per-file split is independent of the user-facing group; one
 * file may contribute to multiple groups when its domain straddles them
 * (e.g. tools.ts → Edit + Review; document.ts → File + Review).
 */
export type CommandGroup = 'File' | 'Edit' | 'View' | 'Review' | 'Export' | 'Help';

export type Command = {
  id: string;
  label: string;
  group: CommandGroup;
  run: (store: DocumentStore) => void | Promise<void>;
};

/**
 * Wrap a command's `run` handler so it short-circuits when Browse Lock is
 * on (showing the standard toast via `guardWriteOrToast`). Every mutating
 * palette command used to open with the same two lines:
 *
 *   run: (s) => {
 *     if (!guardWriteOrToast()) return;
 *     …
 *   }
 *
 * Threading that through a wrapper centralizes the policy — a future
 * change to Browse Lock semantics propagates without touching ~20 call
 * sites — and makes the *intent* (this is a write command) stand out from
 * the command body. Read-only commands (palette toggles, "open dialog…")
 * stay as plain `Command` literals.
 */
export const withWriteGuard = (cmd: Command): Command => ({
  ...cmd,
  run: async (store) => {
    if (!guardWriteOrToast()) return;
    await cmd.run(store);
  },
});
