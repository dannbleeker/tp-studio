// Single seam over window.localStorage. Feature-detects once, exposes typed
// read/write helpers, and centralizes the storage-key list so renaming is a
// one-file change. Failed writes (most often QuotaExceededError) are caught
// and reported via the onStorageError listener; tests can swap behaviour via
// vi.mock if needed.
//
// Session 129 — quota handling. Writes that throw a QuotaExceededError now
// surface via a typed `StorageError` so the upper layer can do something
// useful (auto-trim old revisions, swap the toast to a "storage full"
// message, etc.) instead of just printing the raw error string.

import { log } from '../logger';

export const STORAGE_KEYS = {
  /** Active document, written on every mutation (debounced). */
  doc: 'tp-studio:active-document:v1',
  /** Live draft — written synchronously on EVERY mutation so a tab crash
   *  mid-typing doesn't lose the last 200 ms of edits. On boot, if this key
   *  is present and newer than `doc`, the doc is restored from the live
   *  draft. The committed doc remains the canonical artifact for export. */
  docLive: 'tp-studio:active-document-live:v1',
  /** FL-EX9: previous committed doc, written BEFORE each new committed
   *  write. If the main slot is ever corrupted (mid-write tab kill,
   *  external storage tampering, partial quota failure), the backup gives
   *  us one last good snapshot to fall back to on boot. Updated lazily on
   *  every successful save; never points at junk because the copy happens
   *  before the new write is attempted. */
  docBackup: 'tp-studio:active-document-backup:v1',
  /** UI theme — 'light' | 'dark' | 'highContrast'. */
  theme: 'tp-studio:theme',
  /** User-pickable preferences from the Settings dialog. JSON-encoded. */
  prefs: 'tp-studio:prefs:v1',
  /** H1 revision history. JSON-encoded `Record<docId, Revision[]>` keyed by
   *  document id. Capped to `REVISIONS_PER_DOC_CAP` per doc; oldest dropped
   *  on overflow. */
  revisions: 'tp-studio:revisions:v1',
} as const;

const hasLocalStorage = (): boolean => typeof globalThis.localStorage !== 'undefined';

/**
 * Tagged storage error surfaced to listeners. The `kind` discriminator lets
 * the upper layer choose a tailored response — `'quota'` triggers an
 * auto-trim-and-retry mitigation, anything else just toasts.
 *
 * Detection uses the DOMException `name` field (`'QuotaExceededError'`)
 * which is the standard contract for localStorage in every browser back
 * to IE10. Some private-mode browsers throw `SecurityError` instead of
 * QuotaExceeded — those still classify as `'other'` and surface
 * generically, which is the right call (we can't trim our way out of
 * "storage is disabled").
 */
export type StorageErrorKind = 'quota' | 'other';
export type StorageError = {
  kind: StorageErrorKind;
  cause: Error;
  key: string;
  op: 'read' | 'write' | 'remove';
};

const classifyError = (err: unknown): StorageErrorKind => {
  if (err && typeof err === 'object' && 'name' in err) {
    const name = (err as { name?: unknown }).name;
    if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      return 'quota';
    }
  }
  return 'other';
};

type ErrorListener = (err: StorageError) => void;
let onError: ErrorListener | null = null;

/**
 * Register a listener for storage errors. Returns an unsubscribe function.
 * Only one listener is supported at a time — call sites are layered (store
 * boot wires it once), not many-to-many.
 *
 * Session 129 — the listener now receives a `StorageError` tagged with
 * `kind` ('quota' | 'other'). The store-level handler reads that to decide
 * between auto-trim mitigation (quota) and a passive toast (other).
 */
export const setStorageErrorListener = (listener: ErrorListener | null): (() => void) => {
  onError = listener;
  return () => {
    if (onError === listener) onError = null;
  };
};

const reportError = (err: unknown, key: string, op: 'read' | 'write' | 'remove'): void => {
  const cause = err instanceof Error ? err : new Error(String(err));
  const kind = classifyError(err);
  if (onError) {
    onError({ kind, cause, key, op });
  } else {
    log.warn(`[storage] ${op} failed for ${key} (${kind}):`, cause.message);
  }
};

export const readString = (key: string): string | null => {
  if (!hasLocalStorage()) return null;
  try {
    return globalThis.localStorage.getItem(key);
  } catch (err) {
    reportError(err, key, 'read');
    return null;
  }
};

/**
 * Write a string value. Returns true on success, false on failure (quota
 * exceeded, disabled, private-mode quirks). Callers that want to retry
 * after the listener clears space can check the return and try again.
 */
export const writeString = (key: string, value: string): boolean => {
  if (!hasLocalStorage()) return false;
  try {
    globalThis.localStorage.setItem(key, value);
    return true;
  } catch (err) {
    reportError(err, key, 'write');
    return false;
  }
};

export const removeKey = (key: string): void => {
  if (!hasLocalStorage()) return;
  try {
    globalThis.localStorage.removeItem(key);
  } catch (err) {
    reportError(err, key, 'remove');
  }
};

export const readJSON = <T>(key: string): T | null => {
  const raw = readString(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

/** Same return contract as `writeString`. */
export const writeJSON = <T>(key: string, value: T): boolean =>
  writeString(key, JSON.stringify(value, null, 2));
