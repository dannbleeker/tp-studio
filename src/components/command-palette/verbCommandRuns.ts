import type { DocumentStore } from '@/store';
import { analysisCommands } from './commands/analysis';
import { edgeCommands } from './commands/edges';
import { groupCommands } from './commands/groups';
import { toolCommands } from './commands/tools';

/**
 * Session 135 / Perf #35 — synchronous `id → run` registry for the
 * commands that selection **verbs** dispatch (the SelectionToolbar +
 * the ContextMenu).
 *
 * Why this exists: those two surfaces are always-mounted canvas chrome,
 * so importing the full `COMMANDS` catalogue (`commands/index.ts`) into
 * them dragged *every* command module — including palette-only families
 * (`export` / `help` / `view` / `navigate` / `document`) and the
 * catalogue-assembly glue — onto the eager index chunk, purely to look
 * up a clicked verb's `run`.
 *
 * Every command a verb can dispatch lives in exactly four files
 * (`analysis` / `edges` / `groups` / `tools` — verified by id), and all
 * four are already eager (they hold the verbs' own logic). Importing
 * just those arrays here — instead of the whole catalogue — keeps the
 * verb-run lookup synchronous (no async-dispatch timing hazard) while
 * dropping the palette-only command modules (`document` / `export` /
 * `help` / `navigate` / `view`) + the catalogue-assembly glue from the
 * eager path. The catalogue stays whole behind the lazy CommandPalette.
 *
 * (`commandIcons` stays eager: the toolbar renders verb icons
 * synchronously, so those glyphs are eager wherever they're imported —
 * relocating them wouldn't shrink the critical path.)
 *
 * No duplication / no drift: this reads the same `Command.run` the
 * palette uses; it just imports a subset of the source modules.
 */
const VERB_COMMANDS = [...analysisCommands, ...edgeCommands, ...groupCommands, ...toolCommands];

const RUN_BY_ID: ReadonlyMap<string, (store: DocumentStore) => void | Promise<void>> = new Map(
  VERB_COMMANDS.map((c) => [c.id, c.run])
);

/**
 * Run the verb-backed command with the given id against the current
 * store state, synchronously (no lazy import). No-op when the id isn't a
 * verb-dispatchable command — a registry contract miss, so fail quiet.
 */
export const runVerbCommand = (id: string, store: DocumentStore): void => {
  void RUN_BY_ID.get(id)?.(store);
};

/** Whether `id` resolves to a verb-dispatchable command. */
export const hasVerbCommand = (id: string): boolean => RUN_BY_ID.has(id);
