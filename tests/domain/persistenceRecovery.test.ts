import {
  loadFromLocalStorage,
  loadFromLocalStorageWithStatus,
  saveToLocalStorage,
} from '@/domain/persistence';
import { STORAGE_KEYS } from '@/services/storage';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeDoc, makeEdge, makeEntity, resetIds } from './helpers';

beforeEach(() => {
  resetIds();
  localStorage.clear();
});

const docAt = (updatedAt: number, title = 'Doc') => {
  const a = makeEntity({ type: 'rootCause', title: 'Root' });
  const b = makeEntity({ type: 'ude', title: 'UDE' });
  const base = makeDoc([a, b], [makeEdge(a.id, b.id)], 'crt');
  return { ...base, title, updatedAt };
};

/**
 * FL-EX9 — backup-slot auto-recovery. `saveToLocalStorage` copies the
 * prior committed doc into `docBackup` before writing the new one, so a
 * corrupted main slot (mid-write crash, external tampering, browser
 * quota error mid-flush) falls back to the previous-save snapshot.
 *
 * `loadFromLocalStorageWithStatus` reports HOW the doc was recovered
 * so the boot path can surface a toast.
 */

describe('FL-EX9 — backup-slot recovery', () => {
  it('writes a backup of the prior committed doc on each save', () => {
    const first = docAt(1000, 'first');
    saveToLocalStorage(first);
    // No backup yet — there was no prior doc to back up.
    expect(localStorage.getItem(STORAGE_KEYS.docBackup)).toBeNull();

    const second = docAt(2000, 'second');
    saveToLocalStorage(second);
    // Backup now holds the first save.
    const backupRaw = localStorage.getItem(STORAGE_KEYS.docBackup);
    expect(backupRaw).not.toBeNull();
    expect(JSON.parse(backupRaw!).title).toBe('first');
  });

  it('falls back to the backup when the main slot is corrupted', () => {
    saveToLocalStorage(docAt(1000, 'first'));
    saveToLocalStorage(docAt(2000, 'second'));
    // Simulate a corrupted main slot: backup still has 'first'.
    localStorage.setItem(STORAGE_KEYS.doc, '{ corrupted-json');
    const result = loadFromLocalStorageWithStatus();
    expect(result.doc?.title).toBe('first');
    expect(result.recoveredFromBackup).toBe(true);
    expect(result.recoveredFromLiveDraftOnly).toBe(false);
  });

  it('reports recoveredFromLiveDraftOnly when both main and backup are dead', () => {
    // Write a live-draft directly (mimics what `persistDebounced.writeLiveDraft` does).
    const live = docAt(5000, 'live-only');
    localStorage.setItem(STORAGE_KEYS.docLive, JSON.stringify(live));
    // Corrupt both main + backup.
    localStorage.setItem(STORAGE_KEYS.doc, '{ junk');
    localStorage.setItem(STORAGE_KEYS.docBackup, '{ junk');
    const result = loadFromLocalStorageWithStatus();
    expect(result.doc?.title).toBe('live-only');
    expect(result.recoveredFromBackup).toBe(false);
    expect(result.recoveredFromLiveDraftOnly).toBe(true);
  });

  it('reports clean status on the happy path', () => {
    saveToLocalStorage(docAt(1000, 'committed'));
    const result = loadFromLocalStorageWithStatus();
    expect(result.doc?.title).toBe('committed');
    expect(result.recoveredFromBackup).toBe(false);
    expect(result.recoveredFromLiveDraftOnly).toBe(false);
  });

  it('prefers the newer of (backup, live) when main is corrupt', () => {
    saveToLocalStorage(docAt(1000, 'old-backup'));
    saveToLocalStorage(docAt(2000, 'newer-committed')); // backs up 'old-backup'
    // Now corrupt main and add a live draft that's older than the backup.
    localStorage.setItem(STORAGE_KEYS.doc, '{ junk');
    const olderLive = docAt(500, 'older-live');
    localStorage.setItem(STORAGE_KEYS.docLive, JSON.stringify(olderLive));
    const result = loadFromLocalStorageWithStatus();
    // Backup is newer (1000) than the live draft (500) — backup wins.
    expect(result.doc?.title).toBe('old-backup');
    expect(result.recoveredFromBackup).toBe(true);
  });

  it('legacy loadFromLocalStorage strips the recovery metadata', () => {
    saveToLocalStorage(docAt(1000, 'one'));
    saveToLocalStorage(docAt(2000, 'two'));
    localStorage.setItem(STORAGE_KEYS.doc, '{ junk');
    // Backwards-compatible accessor still returns just the doc.
    const doc = loadFromLocalStorage();
    expect(doc?.title).toBe('one');
  });
});
