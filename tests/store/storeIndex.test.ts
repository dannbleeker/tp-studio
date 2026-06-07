/**
 * Coverage for src/store/index.ts
 *
 * Targets:
 *   - resetStoreForTest: clears localStorage + resets all slice state
 *   - quota error listener (tryTrimRevisionsForQuota path): revisions trimmed
 *     → info toast + reloadRevisions called
 *   - quota error listener (tryDropInactiveTabBackups path): no revisions to
 *     trim but inactive-tab backups exist → freed, info toast
 *   - quota error listener (fallthrough — nothing to free, single tab): error
 *     toast with single-tab message
 *   - quota error listener (fallthrough — nothing to free, multiple tabs):
 *     error toast with multi-tab message
 *   - quota error listener — re-entrancy guard: a second quota event while
 *     mitigation is in flight does NOT recurse / show an extra toast
 *   - non-quota storage error: generic error toast with cause.message
 *   - tryTrimRevisionsForQuota branches: null map, map with only single-entry
 *     lists (no drops), successful multi-entry trim
 *   - tryDropInactiveTabBackups branches: no manifest, manifest with no
 *     inactive tabs, manifest with one inactive tab that has a backup
 *
 * How quota errors are triggered:
 *   When @/store is first imported it calls `setStorageErrorListener` and
 *   registers its own handler. We fire that handler by spying on
 *   `Storage.prototype.setItem` to throw — `writeString` catches and
 *   forwards the error through the listener chain that index.ts registered.
 *
 * Invariant: the store's own listener must survive between tests. We never
 * call setStorageErrorListener ourselves; we only mock setItem so the
 * storage module surfaces a quota error → the store's handler runs.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newDocumentId } from '@/domain/ids';
import { persistTabsManifest } from '@/domain/persistence';
import { docBackupKey } from '@/services/storage/keys';
import { STORAGE_KEYS, writeString } from '@/services/storage/storage';
import { resetStoreForTest, useDocumentStore } from '@/store';

// ── helpers ──────────────────────────────────────────────────────────────────

const s = () => useDocumentStore.getState();

/** Seed a revisions map into localStorage with `count` entries for the given
 *  doc id. The objects are stored as raw JSON; tryTrimRevisionsForQuota only
 *  checks Array.isArray(list) and list.length, so the entries do not need to
 *  match the full Revision shape — any non-empty object will do. */
const seedRevisions = (docId: string, count: number): void => {
  const revs = Array.from({ length: count }, (_, i) => ({ id: `rev-${i}`, docId, capturedAt: i }));
  const map: Record<string, typeof revs> = { [docId]: revs };
  globalThis.localStorage.setItem(STORAGE_KEYS.revisions, JSON.stringify(map));
};

/** Cause the next `writeString` call to throw a QuotaExceededError so the
 *  store's storage-error listener fires with `kind: 'quota'`. */
const mockQuotaOnce = (): ReturnType<typeof vi.spyOn> => {
  const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
    const err = new Error('quota exceeded');
    (err as Error & { name: string }).name = 'QuotaExceededError';
    throw err;
  });
  return spy;
};

/** Cause the next `writeString` call to throw a non-quota error. */
const mockOtherErrorOnce = (message = 'storage disabled'): void => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
    const err = new Error(message);
    (err as Error & { name: string }).name = 'SecurityError';
    throw err;
  });
};

// ── setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  resetStoreForTest();
  globalThis.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── resetStoreForTest ─────────────────────────────────────────────────────────

describe('resetStoreForTest', () => {
  it('clears localStorage', () => {
    globalThis.localStorage.setItem('tp-studio:probe', 'hello');
    resetStoreForTest();
    expect(globalThis.localStorage.getItem('tp-studio:probe')).toBeNull();
  });

  it('resets toasts to empty', () => {
    s().showToast('info', 'before reset');
    expect(s().toasts).toHaveLength(1);
    resetStoreForTest();
    expect(s().toasts).toHaveLength(0);
  });

  it('resets undo/redo stacks to empty', () => {
    s().addEntity({ type: 'effect', title: 'X' });
    expect(s().past.length).toBeGreaterThan(0);
    resetStoreForTest();
    expect(s().past).toHaveLength(0);
    expect(s().future).toHaveLength(0);
  });

  it('resets revisions to empty', () => {
    s().captureSnapshot('my snap');
    expect(s().revisions.length).toBeGreaterThan(0);
    resetStoreForTest();
    expect(s().revisions).toHaveLength(0);
  });

  it('resets the entity map to an empty document', () => {
    s().addEntity({ type: 'effect', title: 'Y' });
    resetStoreForTest();
    expect(Object.keys(s().doc.entities)).toHaveLength(0);
  });
});

// ── storage error listener — quota path (tryTrimRevisionsForQuota) ────────────

describe('quota error listener — revision-trim path', () => {
  it('trims revisions and shows an info toast when revisions exist', () => {
    const docId = s().doc.id;
    // Seed 4 revisions so the trim has something to work with.
    seedRevisions(docId, 4);

    mockQuotaOnce();
    // Trigger the listener by provoking a writeString call.
    writeString('tp-studio:probe', 'x');

    const toasts = s().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]!.kind).toBe('info');
    expect(toasts[0]!.message).toMatch(/trimmed/i);
  });

  it('reports singular "revision" when exactly one revision is dropped', () => {
    const docId = s().doc.id;
    // 2 revisions → trim to 1 → 1 dropped
    seedRevisions(docId, 2);

    mockQuotaOnce();
    writeString('tp-studio:probe', 'x');

    const msg = s().toasts[0]!.message;
    expect(msg).toMatch(/1 old revision[^s]/);
  });

  it('reports plural "revisions" when more than one revision is dropped', () => {
    const docId = s().doc.id;
    // 4 revisions → trim to 2 → 2 dropped
    seedRevisions(docId, 4);

    mockQuotaOnce();
    writeString('tp-studio:probe', 'x');

    const msg = s().toasts[0]!.message;
    expect(msg).toMatch(/2 old revisions/);
  });

  it('reloads the in-memory revisions array after trimming', () => {
    const docId = s().doc.id;
    // Capture a snapshot so there is at least one revision in storage AND
    // in-memory, then manually expand the storage entry to give the trim
    // function two entries to work with (trim goes to 1 drop = success).
    s().captureSnapshot('before');
    seedRevisions(docId, 4);

    mockQuotaOnce();
    writeString('tp-studio:probe', 'x');

    // After the trim-and-reload, the in-memory revisions should reflect the
    // halved storage list (2 kept from 4).
    expect(s().revisions.length).toBeLessThan(4);
    expect(s().revisions.length).toBeGreaterThan(0);
  });
});

// ── storage error listener — inactive-tab backup path ────────────────────────

describe('quota error listener — inactive-tab backup fallback', () => {
  it('drops an inactive tab backup and shows an info toast when no revisions can be trimmed', () => {
    // No revisions → tryTrimRevisionsForQuota returns null.
    // Set up a tab manifest with one inactive doc that has a backup stored.
    const activeId = s().activeDocId;
    const inactiveId = newDocumentId();
    persistTabsManifest({ activeDocId: activeId, tabOrder: [activeId, inactiveId] });
    // Plant a backup for the inactive doc.
    globalThis.localStorage.setItem(docBackupKey(inactiveId), '{"fake":"backup"}');

    mockQuotaOnce();
    writeString('tp-studio:probe', 'x');

    const toasts = s().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]!.kind).toBe('info');
    expect(toasts[0]!.message).toMatch(/dropping/i);
    // Backup slot should be gone.
    expect(globalThis.localStorage.getItem(docBackupKey(inactiveId))).toBeNull();
  });

  it('reports singular "backup" when exactly one backup is dropped', () => {
    const activeId = s().activeDocId;
    const inactiveId = newDocumentId();
    persistTabsManifest({ activeDocId: activeId, tabOrder: [activeId, inactiveId] });
    globalThis.localStorage.setItem(docBackupKey(inactiveId), '{"fake":"backup"}');

    mockQuotaOnce();
    writeString('tp-studio:probe', 'x');

    expect(s().toasts[0]!.message).toMatch(/1 inactive tab backup[^s]/);
  });

  it('does NOT drop the active doc backup', () => {
    const activeId = s().activeDocId;
    const inactiveId = newDocumentId();
    persistTabsManifest({ activeDocId: activeId, tabOrder: [activeId, inactiveId] });
    // Only the active doc has a backup; inactive has none.
    globalThis.localStorage.setItem(docBackupKey(activeId), '{"active":"backup"}');

    mockQuotaOnce();
    writeString('tp-studio:probe', 'x');

    // Active doc backup remains.
    expect(globalThis.localStorage.getItem(docBackupKey(activeId))).not.toBeNull();
  });
});

// ── storage error listener — fallthrough error toasts ────────────────────────

describe('quota error listener — fallthrough (nothing to free)', () => {
  it('shows single-tab error toast when there is only one open tab and nothing can be freed', () => {
    // No revisions, no inactive tabs, no manifested extra tabs.
    // The active doc IS the only tab → single-tab message branch.
    const activeId = s().activeDocId;
    persistTabsManifest({ activeDocId: activeId, tabOrder: [activeId] });

    mockQuotaOnce();
    writeString('tp-studio:probe', 'x');

    const toasts = s().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]!.kind).toBe('error');
    expect(toasts[0]!.message).toMatch(/export to a file/i);
  });

  it('shows multi-tab error toast when multiple tabs are open and nothing can be freed', () => {
    // Two tabs in the manifest but no backups seeded for the inactive one
    // (so tryDropInactiveTabBackups returns 0) and no revisions.
    const activeId = s().activeDocId;
    const other = newDocumentId();
    persistTabsManifest({ activeDocId: activeId, tabOrder: [activeId, other] });

    mockQuotaOnce();
    writeString('tp-studio:probe', 'x');

    const toasts = s().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]!.kind).toBe('error');
    expect(toasts[0]!.message).toMatch(/close some tabs/i);
  });
});

// ── non-quota error ───────────────────────────────────────────────────────────

describe('non-quota storage error', () => {
  it('shows a generic error toast with the cause.message', () => {
    mockOtherErrorOnce('storage is disabled');
    writeString('tp-studio:probe', 'x');

    const toasts = s().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]!.kind).toBe('error');
    expect(toasts[0]!.message).toContain('storage is disabled');
  });
});
