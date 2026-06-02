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
 * palette commands; everywhere else (Firefox / Safari / iOS) the existing
 * download/upload pickers remain the path, unchanged.
 *
 * `window.showSaveFilePicker` / `showOpenFilePicker` and the handle permission
 * methods (`queryPermission` / `requestPermission`) aren't in the TS DOM lib
 * yet (the `FileSystemFileHandle` / `FileSystemWritableFileStream` types ARE),
 * so just those entry points are declared here.
 */

type FilePickerAcceptType = { description?: string; accept: Record<string, string[]> };
type SaveFilePickerOpts = { suggestedName?: string; types?: FilePickerAcceptType[] };
type OpenFilePickerOpts = { multiple?: boolean; types?: FilePickerAcceptType[] };
type FileAccessWindow = typeof window & {
  showSaveFilePicker?: (opts?: SaveFilePickerOpts) => Promise<FileSystemFileHandle>;
  showOpenFilePicker?: (opts?: OpenFilePickerOpts) => Promise<FileSystemFileHandle[]>;
};

/** The File System Access permission methods live on every handle but aren't
 *  in the DOM lib. Both are optional — older Chromium lacked them. */
type PermissionDescriptor = { mode: 'read' | 'readwrite' };
type PermissionedHandle = FileSystemFileHandle & {
  queryPermission?: (descriptor: PermissionDescriptor) => Promise<PermissionState>;
  requestPermission?: (descriptor: PermissionDescriptor) => Promise<PermissionState>;
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

/**
 * Ensure we have (or can obtain) read-write permission for a *persisted*
 * handle. A handle restored from IndexedDB in a later session may need its
 * permission re-confirmed; `requestPermission` prompts the user (it relies on
 * the transient activation from the palette command that called us). Returns
 * `true` when writing is allowed. Handles from older Chromium without the
 * permission API are treated optimistically — the subsequent write throws if
 * access is genuinely denied.
 */
export const ensureWritePermission = async (handle: FileSystemFileHandle): Promise<boolean> => {
  const h = handle as PermissionedHandle;
  const descriptor: PermissionDescriptor = { mode: 'readwrite' };
  if (h.queryPermission && (await h.queryPermission(descriptor)) === 'granted') return true;
  if (h.requestPermission && (await h.requestPermission(descriptor)) === 'granted') return true;
  return !h.queryPermission && !h.requestPermission;
};

/**
 * Write `text` to an already-resolved file handle (createWritable → write →
 * close). Always closes the stream — a half-open writable can leave a 0-byte
 * file. Throws on a genuine write failure (permission denied, disk error).
 */
export const writeTextToHandle = async (
  handle: FileSystemFileHandle,
  text: string
): Promise<void> => {
  const writable = await handle.createWritable();
  try {
    await writable.write(text);
  } finally {
    await writable.close();
  }
};

export type SaveResult =
  | { status: 'saved'; handle: FileSystemFileHandle }
  | { status: 'cancelled' };

/**
 * Show the OS "Save as" dialog and write `text` to the chosen file. Returns
 * the picked `handle` alongside `'saved'` (so the caller can remember it for
 * one-click re-save), or `'cancelled'` if the user dismisses the picker.
 * **Throws** on a genuine write failure so the caller can toast it.
 */
export const saveToFile = async (suggestedName: string, text: string): Promise<SaveResult> => {
  const w = win();
  if (!w?.showSaveFilePicker) return { status: 'cancelled' };
  let handle: FileSystemFileHandle;
  try {
    handle = await w.showSaveFilePicker({ suggestedName, types: JSON_PICKER_TYPES });
  } catch (err) {
    if (isUserAbort(err)) return { status: 'cancelled' };
    throw err;
  }
  await writeTextToHandle(handle, text);
  return { status: 'saved', handle };
};

export type OpenResult = { text: string; handle: FileSystemFileHandle };

/**
 * Show the OS "Open" dialog and return the chosen file's text plus its
 * `handle` (so the caller can link it for re-save), or `null` when the user
 * cancels. **Throws** on a genuine read failure.
 */
export const openFromFile = async (): Promise<OpenResult | null> => {
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
  return { text: await file.text(), handle };
};
