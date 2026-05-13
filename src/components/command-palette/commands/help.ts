import type { Command } from './types';

export const helpCommands: Command[] = [
  {
    id: 'help',
    label: 'Show keyboard shortcuts',
    group: 'Help',
    run: (s) => s.openHelp(),
  },
];
