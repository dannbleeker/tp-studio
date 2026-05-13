import { analysisCommands } from './analysis';
import { documentCommands } from './document';
import { edgeCommands } from './edges';
import { exportCommands } from './export';
import { groupCommands } from './groups';
import { helpCommands } from './help';
import { navigateCommands } from './navigate';
import { toolCommands } from './tools';
import type { Command } from './types';
import { viewCommands } from './view';

export type { Command };

/**
 * The full palette command list. Order here is the order the palette
 * shows commands within each group header; cross-group ordering is
 * driven by alphabetical group name in the renderer.
 *
 * Adding a new command: pick the right per-group file (or create one if
 * the group is new — and remember to extend `Command['group']` in
 * `./types.ts`), then add the entry. No edit to this file is needed for
 * an additional entry inside an existing group.
 */
export const COMMANDS: Command[] = [
  ...documentCommands,
  ...exportCommands,
  ...edgeCommands,
  ...viewCommands,
  ...helpCommands,
  ...toolCommands,
  ...groupCommands,
  ...navigateCommands,
  ...analysisCommands,
];
