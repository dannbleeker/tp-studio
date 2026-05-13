// Single seam over window.localStorage. Feature-detects once, exposes typed
// read/write helpers, and centralizes the storage-key list so renaming is a
// one-file change. Failed writes (most often QuotaExceededError) are caught
// and reported via the onStorageError listener; tests can swap behaviour via
// vi.mock if needed.

import { log } from './logger';

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

type ErrorListener = (err: Error) => void;
let onError: ErrorListener | null = null;

/**
 * Register a listener for storage errors (typically QuotaExceededError).
 * Returns an unsubscribe function. Only one listener is supported at a time —
 * call sites are layered (store boot wires it once), not many-to-many.
 */
export const setStorageErrorListener = (listener: ErrorListener | null): (() => void) => {
  onError = listener;
  return () => {
    if (onError === listener) onError = null;
  };
};

const reportError = (err: unknown): void => {
  const wrapped = err instanceof Error ? err : new Error(String(err));
  if (onError) {
    onError(wrapped);
  } else {
    log.warn('[storage] write failed:', wrapped.message);
  }
};

export const readString = (key: string): string | null => {
  if (!hasLocalStorage()) return null;
  try {
    return globalThis.localStorage.getItem(key);
  } catch (err) {
    reportError(err);
    return null;
  }
};

export const writeString = (key: string, value: string): void => {
  if (!hasLocalStorage()) return;
  try {
    globalThis.localStorage.setItem(key, value);
  } catch (err) {
    reportError(err);
  }
};

export const removeKey = (key: string): void => {
  if (!hasLocalStorage()) return;
  try {
    globalThis.localStorage.removeItem(key);
  } catch (err) {
    reportError(err);
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

export const writeJSON = <T>(key: string, value: T): void => {
  writeString(key, JSON.stringify(value, null, 2));
};
