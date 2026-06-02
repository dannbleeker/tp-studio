import { exportToJSON, importFromJSON } from '@/domain/persistence';
import { getCanvasInstance } from '@/services/canvasRef';
import { errorMessage } from '@/services/errors';
import { slug } from '@/services/exporters/shared';
import { openFromFile, saveToFile } from '@/services/fileSystemAccess';
import { currentDoc } from '@/store/selectors';
import { type Command, withWriteGuard } from './types';

/**
 * "Save to file…" / "Open from file…" — the File System Access additions
 * (backlog: store trees on OneDrive). PURELY ADDITIVE: same JSON as the
 * existing Export/Import, written to / read from a real file on disk. Dropped
 * in a synced `OneDrive\…` folder, the OS client syncs it cross-device.
 *
 * Registered ONLY where the API exists — see the `isFileAccessSupported()`
 * gate in `commands/index.ts`. Everywhere else the existing Export/Import
 * (download/upload) pickers remain the path, unchanged. localStorage auto-save
 * and the tabs are untouched.
 */

// Two animation frames let React Flow reconcile the loaded node set before the
// fit-to-bounds call. (Same helper shape as `ImportPickerDialog`'s — kept local
// to avoid a cross-import; behaviour-identical.)
const fitViewAfterLoad = (): void => {
  if (typeof window === 'undefined') return;
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      getCanvasInstance()?.fitView({ padding: 0.4, maxZoom: 1.2 });
    });
  });
};

export const fileAccessCommands: Command[] = [
  {
    // Not write-guarded: saving the current doc to a file is read-only w.r.t.
    // the document — usable under Browse Lock, like Export.
    id: 'save-to-file',
    label: 'Save to file…',
    group: 'File',
    run: async (s) => {
      const doc = currentDoc(s);
      try {
        const result = await saveToFile(`${slug(doc.title)}.tps.json`, exportToJSON(doc));
        if (result === 'saved') s.showToast('success', 'Saved to file.');
        else s.showToast('info', 'Save cancelled.');
      } catch (err) {
        s.showToast('error', `Couldn't save to file: ${errorMessage(err)}`);
      }
    },
  },
  withWriteGuard({
    // Write-guarded: opening a file loads a new document (like Import…).
    id: 'open-from-file',
    label: 'Open from file…',
    group: 'File',
    run: async (s) => {
      let text: string | null;
      try {
        text = await openFromFile();
      } catch (err) {
        s.showToast('error', `Couldn't open the file: ${errorMessage(err)}`);
        return;
      }
      if (text === null) return; // user cancelled the picker
      let doc: ReturnType<typeof importFromJSON>;
      try {
        doc = importFromJSON(text);
      } catch (err) {
        s.showToast('error', `That file isn't a valid TP Studio document: ${errorMessage(err)}`);
        return;
      }
      s.openDocInTab(doc);
      fitViewAfterLoad();
    },
  }),
];
