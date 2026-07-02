import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetLastExportForTest,
  getLastExportId,
  recordLastExport,
} from '@/services/storage/recentExports';

/**
 * Session 193 — the Export picker's single last-used-format memory.
 *
 * Mirrors `recentCommands` but stores just one id (the last format the user
 * exported) so the picker can auto-focus / mark it. Persistence is best-effort:
 * a throwing localStorage must degrade to session memory, never crash.
 */

beforeEach(() => {
  __resetLastExportForTest();
  window.localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('recentExports', () => {
  it('returns null before anything is recorded', () => {
    expect(getLastExportId()).toBeNull();
  });

  it('remembers the last recorded id', () => {
    recordLastExport('png');
    expect(getLastExportId()).toBe('png');
    recordLastExport('pptx');
    expect(getLastExportId()).toBe('pptx');
  });

  it('persists across a memo reset (reads back from localStorage)', () => {
    recordLastExport('svg');
    __resetLastExportForTest();
    expect(getLastExportId()).toBe('svg');
  });

  it('degrades to session memory when localStorage.setItem throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => recordLastExport('json')).not.toThrow();
    // The in-memory value still updates even though the write failed.
    expect(getLastExportId()).toBe('json');
    spy.mockRestore();
  });

  it('degrades to null when localStorage.getItem throws', () => {
    __resetLastExportForTest();
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(getLastExportId()).toBeNull();
    spy.mockRestore();
  });
});
