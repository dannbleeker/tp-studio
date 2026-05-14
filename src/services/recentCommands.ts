/**
 * Session 88 (S17) — Recent palette commands.
 *
 * Tracks the last `RECENT_COMMANDS_LIMIT` palette commands the user
 * ran. The list is mirrored to `localStorage` so it survives a
 * refresh; the palette renders a "Recent" section at the top of the
 * unfiltered view so frequently-used commands are one click closer.
 *
 * When the user types a query, the Recent section disappears — the
 * existing flat-sorted view already handles filtering and would
 * be confused by a duplicated entry that has its own "Recent" prefix.
 *
 * Persistence is best-effort. If `localStorage` is unavailable
 * (private mode, embedded surfaces), the recents live in memory for
 * the session only. Failures are logged through the shared
 * services/logger so they don't crash the palette.
 */
import { log } from './logger';

const STORAGE_KEY = 'tp-recent-commands';
export const RECENT_COMMANDS_LIMIT = 5;

const readStorage = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Validate shape — anything malformed gets treated as empty
    // rather than crashing the palette on first open.
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string').slice(0, RECENT_COMMANDS_LIMIT);
  } catch (err) {
    log.warn('recent-commands-read-failed', err);
    return [];
  }
};

const writeStorage = (ids: string[]): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch (err) {
    log.warn('recent-commands-write-failed', err);
  }
};

let memo: string[] | null = null;

/** Read the current recents list (most-recent first). */
export const getRecentCommandIds = (): string[] => {
  if (memo === null) memo = readStorage();
  return memo;
};

/**
 * Record one palette command activation. Moves the id to the front
 * and trims the list to the limit. Re-runs of the same command
 * don't create duplicates; they refresh the position.
 */
export const recordRecentCommand = (id: string): void => {
  const current = getRecentCommandIds();
  const next = [id, ...current.filter((x) => x !== id)].slice(0, RECENT_COMMANDS_LIMIT);
  memo = next;
  writeStorage(next);
};

/** Test-only reset hook. Keeps the prod surface ergonomic. */
export const __resetRecentCommandsForTest = (): void => {
  memo = null;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore — best-effort
  }
};
