// Single seam over window.localStorage. Feature-detects once and exposes
// typed read/write helpers. Tests can swap this module via vi.mock if needed,
// and all storage keys live here so renaming is a one-file change.

export const STORAGE_KEYS = {
  /** Active document, written on every mutation. */
  doc: 'tp-studio:active-document:v1',
  /** UI theme — 'light' or 'dark'. */
  theme: 'tp-studio:theme',
} as const;

const hasLocalStorage = (): boolean => typeof globalThis.localStorage !== 'undefined';

export const readString = (key: string): string | null => {
  if (!hasLocalStorage()) return null;
  return globalThis.localStorage.getItem(key);
};

export const writeString = (key: string, value: string): void => {
  if (!hasLocalStorage()) return;
  globalThis.localStorage.setItem(key, value);
};

export const removeKey = (key: string): void => {
  if (!hasLocalStorage()) return;
  globalThis.localStorage.removeItem(key);
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
