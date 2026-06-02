/**
 * Browser File System Access API — "Save to file / Open from file".
 *
 * PURELY ADDITIVE. This is a NEW publish/open target for the *same* JSON the
 * app already exports/imports (`exportToJSON` / `importFromJSON`). It does NOT
 * change localStorage auto-save (still the live source of truth), the tabs, or
 * the existing Export/Import (download/upload) pickers. Pointed at a locally
 * synced `OneDrive\…` folder, the OS client syncs the written file cross-device
 * — with zero Microsoft auth, Azure app, OAuth, or new runtime dependency.
 *
 * Chromium-only (Chrome / Edge / Opera). `isFileAccessSupported()` gates the
 * two palette commands; everywhere else (Firefox / Safari / iOS) the existing
 * download/upload pickers remain the path, unchanged.
 *
 * `window.showSaveFilePicker` / `showOpenFilePicker` aren't in the TS DOM lib
 * yet (the `FileSystemFileHandle` / `FileSystemWritableFileStream` types ARE),
 * so only the two picker entry points are declared here.
 */

type FilePickerAcceptType = { description?: string; accept: Record<string, string[]> };
type SaveFilePickerOpts = { suggestedName?: string; types?: FilePickerAcceptType[] };
type OpenFilePickerOpts = { multiple?: boolean; types?: FilePickerAcceptType[] };
type FileAccessWindow = typeof window & {
  showSaveFilePicker?: (opts?: SaveFilePickerOpts) => Promise<FileSystemFileHandle>;
  showOpenFilePicker?: (opts?: OpenFilePickerOpts) => Promise<FileSystemFileHandle[]>;
};

const win = (): FileAccessWindow | null =>
  typeof window === 'undefined' ? null : (window as FileAccessWindow);

/**
 * Whether this browser supports the native save/open file pickers (Chromium:
 * Chrome / Edge / Opera). Firefox, Safari, and all of iOS return `false`.
 */
export const isFileAccessSupported = (): boolean => {
  const w = win();
  return (
    w != null &&
    typeof w.showSaveFilePicker === 'function' &&
    typeof w.showOpenFilePicker === 'function'
  );
};

/** The single `.json` accept filter shared by the save + open pickers. */
const JSON_PICKER_TYPES: FilePickerAcceptType[] = [
  { description: 'TP Studio document', accept: { 'application/json': ['.json'] } },
];

/** Dismissing the OS picker rejects with `AbortError` — a benign cancel, not a
 *  failure. Anything else is a real error worth surfacing. */
const isUserAbort = (err: unknown): boolean =>
  err instanceof DOMException && err.name === 'AbortError';

export type SaveResult = 'saved' | 'cancelled';

/**
 * Show the OS "Save as" dialog and write `text` to the chosen file. Returns
 * `'cancelled'` if the user dismisses the picker; **throws** on a genuine
 * write failure (permission denied, disk error) so the caller can toast it.
 */
export const saveToFile = async (suggestedName: string, text: string): Promise<SaveResult> => {
  const w = win();
  if (!w?.showSaveFilePicker) return 'cancelled';
  let handle: FileSystemFileHandle;
  try {
    handle = await w.showSaveFilePicker({ suggestedName, types: JSON_PICKER_TYPES });
  } catch (err) {
    if (isUserAbort(err)) return 'cancelled';
    throw err;
  }
  const writable = await handle.createWritable();
  try {
    await writable.write(text);
  } finally {
    // Always close the stream — a half-open writable can leave a 0-byte file.
    await writable.close();
  }
  return 'saved';
};

/**
 * Show the OS "Open" dialog and return the chosen file's text, or `null` when
 * the user cancels. **Throws** on a genuine read failure.
 */
export const openFromFile = async (): Promise<string | null> => {
  const w = win();
  if (!w?.showOpenFilePicker) return null;
  let handles: FileSystemFileHandle[];
  try {
    handles = await w.showOpenFilePicker({ multiple: false, types: JSON_PICKER_TYPES });
  } catch (err) {
    if (isUserAbort(err)) return null;
    throw err;
  }
  const handle = handles[0];
  if (!handle) return null;
  const file = await handle.getFile();
  return file.text();
};
