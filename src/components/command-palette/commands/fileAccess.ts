import { exportToJSON, importFromJSON } from '@/domain/persistence';
import { getCanvasInstance } from '@/services/canvasRef';
import { errorMessage } from '@/services/errors';
import { slug } from '@/services/exporters/shared';
import {
  ensureWritePermission,
  openFromFile,
  saveToFile,
  writeTextToHandle,
} from '@/services/fileSystemAccess';
import { getLinkedFile, linkFile, unlinkFile } from '@/services/storage/fileHandles';
import type { DocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';
import { type Command, withWriteGuard } from './types';

/**
 * "Save to file" / "Save to file as…" / "Open from file…" — the File System
 * Access additions (backlog: store trees on OneDrive). PURELY ADDITIVE: the
 * same JSON as the existing Export/Import, written to / read from a real file
 * on disk. Dropped in a synced `OneDrive\…` folder, the OS client syncs it
 * cross-device.
 *
 * One-click re-save: a save/open *links* the chosen file to the document (its
 * `FileSystemFileHandle`, persisted in IndexedDB — see
 * `services/storage/fileHandles`). "Save to file" then re-writes that same
 * file without re-prompting; "Save to file as…" always picks a fresh location.
 *
 * Registered ONLY where the API exists — see the `isFileAccessSupported()`
 * gate in `commands/index.ts`. Everywhere else the existing Export/Import
 * (download/upload) pickers remain the path, unchanged. localStorage auto-save
 * and the tabs are untouched.
 */

const SAVE_AS_LABEL = 'Save to file as…';

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

/** Pick a location, write there, and remember it for one-click re-save.
 *  Throws are left to the caller to toast. */
const pickSaveAndLink = async (s: DocumentStore): Promise<void> => {
  const doc = currentDoc(s);
  const result = await saveToFile(`${slug(doc.title)}.tps.json`, exportToJSON(doc));
  if (result.status === 'cancelled') {
    s.showToast('info', 'Save cancelled.');
    return;
  }
  await linkFile(doc.id, result.handle);
  s.showToast('success', `Saved to ${result.handle.name}.`);
};

/** `pickSaveAndLink` with any failure surfaced as a toast — the shared body of
 *  "Save to file as…" and the fall-back path of "Save to file". */
const pickSaveLinkOrToast = async (s: DocumentStore): Promise<void> => {
  try {
    await pickSaveAndLink(s);
  } catch (err) {
    s.showToast('error', `Couldn't save to file: ${errorMessage(err)}`);
  }
};

export const fileAccessCommands: Command[] = [
  {
    // Not write-guarded: saving the current doc is read-only w.r.t. the
    // document — usable under Browse Lock, like Export.
    id: 'save-to-file',
    label: 'Save to file',
    group: 'File',
    run: async (s) => {
      const doc = currentDoc(s);
      const linked = await getLinkedFile(doc.id).catch(() => null);

      if (linked) {
        const permitted = await ensureWritePermission(linked.handle).catch(() => false);
        if (permitted) {
          // The happy path: re-write the remembered file, no picker.
          try {
            await writeTextToHandle(linked.handle, exportToJSON(doc));
            s.showToast('success', `Saved to ${linked.name}.`);
          } catch (err) {
            // The file was moved / deleted / access revoked → forget the link
            // so the next save re-picks, and tell the user how.
            await unlinkFile(doc.id).catch(() => undefined);
            s.showToast(
              'error',
              `Couldn't save to ${linked.name}: ${errorMessage(err)}. Use "${SAVE_AS_LABEL}" to pick a new file.`
            );
          }
          return;
        }
        // Permission not granted (e.g. denied the re-prompt) → fall through to
        // a fresh pick rather than failing silently.
        s.showToast('info', `Lost write access to ${linked.name}. Choose where to save.`);
      }

      await pickSaveLinkOrToast(s);
    },
  },
  {
    // Always picks a location (and re-links). The escape hatch from the
    // remembered-file re-save above — "save a copy somewhere else".
    id: 'save-to-file-as',
    label: SAVE_AS_LABEL,
    group: 'File',
    run: pickSaveLinkOrToast,
  },
  withWriteGuard({
    // Write-guarded: opening a file loads a new document (like Import…).
    id: 'open-from-file',
    label: 'Open from file…',
    group: 'File',
    run: async (s) => {
      let opened: Awaited<ReturnType<typeof openFromFile>>;
      try {
        opened = await openFromFile();
      } catch (err) {
        s.showToast('error', `Couldn't open the file: ${errorMessage(err)}`);
        return;
      }
      if (opened === null) return; // user cancelled the picker
      let doc: ReturnType<typeof importFromJSON>;
      try {
        doc = importFromJSON(opened.text);
      } catch (err) {
        s.showToast('error', `That file isn't a valid TP Studio document: ${errorMessage(err)}`);
        return;
      }
      s.openDocInTab(doc);
      // Remember the source file so "Save to file" writes straight back to it.
      await linkFile(doc.id, opened.handle).catch(() => undefined);
      fitViewAfterLoad();
    },
  }),
];
