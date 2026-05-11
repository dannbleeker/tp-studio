import type { DocumentStore } from '../../store';

export type Command = {
  id: string;
  label: string;
  group: 'Document' | 'View' | 'Help' | 'Tools';
  shortcut?: string;
  run: (store: DocumentStore) => void;
};

export const COMMANDS: Command[] = [
  {
    id: 'new-crt',
    label: 'New Current Reality Tree',
    group: 'Document',
    run: (s) => s.newDocument('crt'),
  },
  {
    id: 'new-frt',
    label: 'New Future Reality Tree',
    group: 'Document',
    run: (s) => s.newDocument('frt'),
  },
  {
    id: 'toggle-theme',
    label: 'Toggle dark mode',
    group: 'View',
    run: (s) => s.toggleTheme(),
  },
  {
    id: 'undo',
    label: 'Undo',
    group: 'Tools',
    shortcut: 'Ctrl+Z',
    run: (s) => s.undo(),
  },
  {
    id: 'redo',
    label: 'Redo',
    group: 'Tools',
    shortcut: 'Ctrl+Shift+Z',
    run: (s) => s.redo(),
  },
];
