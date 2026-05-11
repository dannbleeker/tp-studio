import { getCanvasNodes, getSelectedEdges } from '../../services/canvasRef';
import { exportJSON, exportPNG, pickJSON } from '../../services/exporters';
import type { DocumentStore } from '../../store';

export type Command = {
  id: string;
  label: string;
  group: 'Document' | 'View' | 'Help' | 'Tools' | 'Export' | 'Edges';
  shortcut?: string;
  run: (store: DocumentStore) => void | Promise<void>;
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
    id: 'import-json',
    label: 'Import from JSON…',
    group: 'Document',
    run: async (s) => {
      const doc = await pickJSON();
      if (doc) s.setDocument(doc);
    },
  },
  {
    id: 'export-json',
    label: 'Export as JSON',
    group: 'Export',
    run: (s) => exportJSON(s.doc),
  },
  {
    id: 'export-png',
    label: 'Export as PNG (2×)',
    group: 'Export',
    run: async (s) => {
      const nodes = getCanvasNodes();
      await exportPNG(s.doc, nodes);
    },
  },
  {
    id: 'group-and',
    label: 'Group selected edges as AND',
    group: 'Edges',
    run: (s) => {
      const ids = getSelectedEdges().map((e) => e.id);
      const result = s.groupAsAnd(ids);
      if (!result.ok) window.alert(result.reason);
    },
  },
  {
    id: 'ungroup-and',
    label: 'Ungroup selected AND edges',
    group: 'Edges',
    run: (s) => {
      const ids = getSelectedEdges().map((e) => e.id);
      if (ids.length === 0) {
        window.alert('Select one or more AND-grouped edges first.');
        return;
      }
      s.ungroupAnd(ids);
    },
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
