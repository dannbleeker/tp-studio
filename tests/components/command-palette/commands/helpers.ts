import { expect } from 'vitest';
import type { Command } from '@/components/command-palette/commands/types';
import { useDocumentStore } from '@/store';

/**
 * Tiny helper for the per-file command tests. Looks up a command in
 * the registry by `id`, asserts it exists (gives a useful failure
 * message), and returns it for `run()` invocation. Keeps every test
 * a 2-liner:
 *
 *   const cmd = findCommand(documentCommands, 'open-quick-capture');
 *   await cmd.run(useDocumentStore.getState());
 *   expect(useDocumentStore.getState().quickCaptureOpen).toBe(true);
 */
export const findCommand = (cmds: readonly Command[], id: string): Command => {
  const c = cmds.find((c) => c.id === id);
  expect(c, `command not registered: ${id}`).toBeDefined();
  return c as Command;
};

/** Invoke a command's run handler with the current store state. */
export const runCommand = async (cmd: Command): Promise<void> => {
  await cmd.run(useDocumentStore.getState());
};
