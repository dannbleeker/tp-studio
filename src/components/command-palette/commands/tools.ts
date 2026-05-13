import { validate } from '@/domain/validators';
import { copySelection, cutSelection, pasteClipboard } from '@/services/clipboard';
import { type Command, withWriteGuard } from './types';

export const toolCommands: Command[] = [
  {
    id: 'run-validation',
    label: 'Run validation',
    group: 'Review',
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
  withWriteGuard({
    id: 'swap-entities',
    label: 'Swap selected entities',
    group: 'Edit',
    run: (s) => {
      const sel = s.selection;
      if (sel.kind !== 'entities' || sel.ids.length !== 2 || !sel.ids[0] || !sel.ids[1]) {
        s.showToast('info', 'Select exactly two entities to swap.');
        return;
      }
      s.swapEntities(sel.ids[0], sel.ids[1]);
      s.showToast('success', 'Swapped entities.');
    },
  }),
  // Copy is intentionally NOT guarded — reading the selection into the
  // clipboard doesn't modify the doc, so it stays usable in browse-lock.
  {
    id: 'copy-selection',
    label: 'Copy selection',
    group: 'Edit',
    run: (s) => {
      const n = copySelection();
      if (n > 0) s.showToast('info', `Copied ${n} entit${n === 1 ? 'y' : 'ies'}.`);
      else s.showToast('info', 'Nothing to copy — select entities first.');
    },
  },
  withWriteGuard({
    id: 'cut-selection',
    label: 'Cut selection',
    group: 'Edit',
    run: (s) => {
      const n = cutSelection();
      if (n > 0) s.showToast('info', `Cut ${n} entit${n === 1 ? 'y' : 'ies'}.`);
    },
  }),
  withWriteGuard({
    id: 'paste-clipboard',
    label: 'Paste',
    group: 'Edit',
    run: (s) => {
      const r = pasteClipboard();
      if (r.ok) s.showToast('success', `Pasted ${r.entities} entities, ${r.edges} edges.`);
      else s.showToast('info', 'Clipboard is empty.');
    },
  }),
  withWriteGuard({
    id: 'undo',
    label: 'Undo',
    group: 'Edit',
    run: (s) => {
      s.undo();
    },
  }),
  withWriteGuard({
    id: 'redo',
    label: 'Redo',
    group: 'Edit',
    run: (s) => {
      s.redo();
    },
  }),
];
