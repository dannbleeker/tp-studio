/**
 * Remembers the single most-recently-used export format so the Export picker
 * can auto-focus it (Enter re-runs the last export) and mark it "last used".
 * Best-effort localStorage persistence, mirroring `recentCommands` — failures
 * degrade to session-only memory rather than crashing the picker.
 */
import { log } from '../logger';

const STORAGE_KEY = 'tp-last-export';

// `undefined` = not yet loaded; `null` = loaded, nothing recorded.
let memo: string | null | undefined;

/** The id of the last export the user ran, or `null` if none. */
export const getLastExportId = (): string | null => {
  if (memo === undefined) {
    memo = null;
    if (typeof window !== 'undefined') {
      try {
        memo = window.localStorage.getItem(STORAGE_KEY) || null;
      } catch (err) {
        log.warn('recent-exports-read-failed', err);
      }
    }
  }
  return memo;
};

/** Record the export the user just ran. */
export const recordLastExport = (id: string): void => {
  memo = id;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch (err) {
    log.warn('recent-exports-write-failed', err);
  }
};

/** Test-only reset hook. */
export const __resetLastExportForTest = (): void => {
  memo = undefined;
};
