// Single seam over window.localStorage. Feature-detects once, exposes typed
// read/write helpers, and centralizes the storage-key list so renaming is a
// one-file change. Failed writes (most often QuotaExceededError) are caught
// and reported via the onStorageError listener; tests can swap behaviour via
// vi.mock if needed.

export const STORAGE_KEYS = {
  /** Active document, written on every mutation. */
  doc: 'tp-studio:active-document:v1',
  /** UI theme — 'light' or 'dark'. */
  theme: 'tp-studio:theme',
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
    // eslint-disable-next-line no-console
    console.warn('[storage] write failed:', wrapped.message);
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
