import { type DocumentStore, useDocumentStore } from '@/store';

/**
 * Session 135 / Perf #35 — lazily dispatch a palette command by id.
 *
 * The eager canvas chrome (`SelectionToolbar`, `ContextMenu` via
 * `contextMenuItems`) used to statically `import { COMMANDS }`, which
 * pulled the whole command catalogue (nine `commands/*` modules) into
 * the eager index chunk purely so a verb click could find its command's
 * `run`. Verb *labels* and *icons* come from the verb itself, so the
 * catalogue is only needed at dispatch time — a user action.
 *
 * This imports the catalogue lazily and caches the resolved `id → run`
 * map. After the first dispatch (or once the already-lazy CommandPalette
 * has loaded), the map is in memory. With no remaining *eager* importer
 * of `./commands`, Rollup ships the command tree in the palette's lazy
 * chunk instead of index.
 *
 * The store state is read at run time (after the import resolves) rather
 * than captured at click time — a microtask later, but that's the more
 * correct snapshot to act on, and matches `cmd.run(getState())`.
 */
type CommandRun = (store: DocumentStore) => void | Promise<void>;

let runMapPromise: Promise<Map<string, CommandRun>> | null = null;

const loadRunMap = (): Promise<Map<string, CommandRun>> => {
  if (!runMapPromise) {
    runMapPromise = import('./commands').then(
      ({ COMMANDS }) => new Map(COMMANDS.map((c) => [c.id, c.run]))
    );
  }
  return runMapPromise;
};

/**
 * Run the palette command with the given id against the current document
 * store state. No-op when the id isn't in the catalogue (the
 * `paletteCommandId` on a selection verb is a registry contract, so a
 * miss means the command was renamed/removed — fail quiet rather than
 * throw mid-gesture).
 */
export const runPaletteCommand = async (id: string): Promise<void> => {
  const run = (await loadRunMap()).get(id);
  if (run) await run(useDocumentStore.getState());
};
