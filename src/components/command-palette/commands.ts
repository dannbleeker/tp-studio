import { buildExampleCRT, buildExampleFRT } from '../../domain/examples';
import { validate } from '../../domain/validators';
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
    id: 'load-example-crt',
    label: 'Load example Current Reality Tree',
    group: 'Document',
    run: (s) => {
      s.setDocument(buildExampleCRT());
      s.showToast('info', 'Loaded example CRT.');
    },
  },
  {
    id: 'load-example-frt',
    label: 'Load example Future Reality Tree',
    group: 'Document',
    run: (s) => {
      s.setDocument(buildExampleFRT());
      s.showToast('info', 'Loaded example FRT.');
    },
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
    id: 'help',
    label: 'Show keyboard shortcuts',
    group: 'Help',
    run: (s) => s.openHelp(),
  },
  {
    id: 'run-validation',
    label: 'Run validation',
    group: 'Tools',
    run: (s) => {
      const warnings = validate(s.doc);
      const open = warnings.filter((w) => !w.resolved).length;
      const resolved = warnings.filter((w) => w.resolved).length;
      if (warnings.length === 0) {
        s.showToast('success', 'No CLR concerns to surface.');
      } else if (open === 0) {
        s.showToast('success', `All ${resolved} CLR concern${resolved === 1 ? '' : 's'} resolved.`);
      } else {
        const suffix = resolved > 0 ? `, ${resolved} resolved` : '';
        s.showToast('info', `${open} open CLR concern${open === 1 ? '' : 's'}${suffix}.`);
      }
    },
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
