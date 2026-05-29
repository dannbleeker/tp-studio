/**
 * Multi-doc tabs Phase 2, Batch 2.2 — per-doc persistence + tab manifest.
 * See `docs/MULTI_DOC_TABS_PLAN.md`.
 *
 * Batch 2.2 adds per-doc localStorage slots (committed / live / backup,
 * keyed by `doc.id`) plus a tab manifest, and boots through them with a
 * one-time migration from the legacy single-doc slots. The legacy slots
 * are kept DUAL-WRITTEN through Phase 2 so a rollback / older cached PWA
 * shell still boots. These tests pin:
 *
 *   - round-trip through the per-doc slots + manifest
 *   - the legacy dual-write (downgrade safety)
 *   - per-doc backup rotation + committed/live/backup recovery precedence
 *   - migration from a legacy-only store, then manifest-path on re-boot
 *   - malformed / missing manifest + lost-body fallbacks
 *   - clearLocalStorage drops the new slots too
 *   - an end-to-end store → scheduler → boot reload (the automated proxy
 *     for the manual reload smoke test)
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearLocalStorage,
  loadAllTabsWithStatus,
  loadFromLocalStorage,
  persistActiveDoc,
  persistTabsManifest,
  readTabsManifest,
  saveDocToLocalStorage,
  saveToLocalStorage,
} from '@/domain/persistence';
import type { DocumentId, TPDocument } from '@/domain/types';
import {
  docBackupKey,
  docCommittedKey,
  docLiveKey,
  tabsManifestKey,
} from '@/services/storage/keys';
import { flushPersist } from '@/services/storage/persistDebounced';
import { STORAGE_KEYS } from '@/services/storage/storage';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../helpers/seedDoc';
import { makeDoc, makeEdge, makeEntity, resetIds } from './helpers';

beforeEach(() => {
  resetIds();
  localStorage.clear();
  // Also resets the in-memory `lastCommittedRaw` cache inside persistence.ts
  // so the legacy backup-rotation can't leak a stale payload across tests.
  clearLocalStorage();
});

const id = (s: string): DocumentId => s as DocumentId;

/** Build a valid v8 doc with an explicit id + updatedAt (makeDoc hardcodes
 *  both, so we override them for the per-doc / recency assertions). */
const buildDoc = (docId: string, updatedAt: number, title = 'Doc'): TPDocument => {
  const a = makeEntity({ type: 'rootCause', title: 'Root' });
  const b = makeEntity({ type: 'ude', title: 'UDE' });
  const base = makeDoc([a, b], [makeEdge(a.id, b.id)], 'crt');
  return { ...base, id: id(docId), title, updatedAt };
};

describe('Batch 2.2 — persistActiveDoc / loadAllTabsWithStatus round-trip', () => {
  it('round-trips the active doc through the per-doc slots + manifest', () => {
    persistActiveDoc(buildDoc('doc_aaa', 1000, 'Active'));
    // The manifest is the tab actions' job (not persistActiveDoc's); mimic
    // an open tab so loadAllTabsWithStatus takes the manifest path.
    persistTabsManifest({ activeDocId: id('doc_aaa'), tabOrder: [id('doc_aaa')] });

    const res = loadAllTabsWithStatus();
    expect(res.activeDocId).toBe('doc_aaa');
    expect(res.tabOrder).toEqual(['doc_aaa']);
    expect(res.docs[id('doc_aaa')]?.title).toBe('Active');
    expect(res.migratedFromLegacy).toBe(false);
    expect(res.recoveredFromBackup).toBe(false);
    expect(res.recoveredFromLiveDraftOnly).toBe(false);
  });

  it('persistActiveDoc does NOT clobber a multi-tab manifest (5.4 regression)', () => {
    // A multi-tab manifest is in place (written by the tab actions)…
    persistTabsManifest({ activeDocId: id('doc_b'), tabOrder: [id('doc_a'), id('doc_b')] });
    // …and the debounced auto-save commits the active doc.
    persistActiveDoc(buildDoc('doc_b', 1000));
    // The manifest must be untouched. Previously persistActiveDoc wrote a
    // single-tab `[doc_b]` here, dropping doc_a on the next reload.
    expect(readTabsManifest()).toEqual({ activeDocId: 'doc_b', tabOrder: ['doc_a', 'doc_b'] });
  });

  it('dual-writes the legacy single-doc slot for downgrade safety', () => {
    const doc = buildDoc('doc_ccc', 1000, 'Legacy-too');
    persistActiveDoc(doc);
    // New per-doc slot...
    expect(localStorage.getItem(docCommittedKey(id('doc_ccc')))).toBe(JSON.stringify(doc));
    // ...AND the legacy slot a pre-2.2 build reads.
    expect(localStorage.getItem(STORAGE_KEYS.doc)).toBe(JSON.stringify(doc));
    expect(loadFromLocalStorage()?.title).toBe('Legacy-too');
  });
});

describe('Batch 2.2 — per-doc backup rotation', () => {
  it('copies the prior committed body into the per-doc backup before overwriting', () => {
    saveDocToLocalStorage(buildDoc('doc_x', 1000, 'v1'));
    // Nothing prior to roll on the first save.
    expect(localStorage.getItem(docBackupKey(id('doc_x')))).toBeNull();

    saveDocToLocalStorage(buildDoc('doc_x', 2000, 'v2'));
    const backup = localStorage.getItem(docBackupKey(id('doc_x')));
    const committed = localStorage.getItem(docCommittedKey(id('doc_x')));
    expect(backup).not.toBeNull();
    expect(JSON.parse(backup as string).title).toBe('v1');
    expect(JSON.parse(committed as string).title).toBe('v2');
  });
});

describe('Batch 2.2 — per-doc recovery on the manifest path', () => {
  it('recovers the active doc from its per-doc backup when committed is corrupt', () => {
    saveDocToLocalStorage(buildDoc('doc_r', 1000, 'good-backup'));
    saveDocToLocalStorage(buildDoc('doc_r', 2000, 'newer')); // backup ← good-backup
    persistTabsManifest({ activeDocId: id('doc_r'), tabOrder: [id('doc_r')] });
    localStorage.setItem(docCommittedKey(id('doc_r')), '{ corrupt');

    const res = loadAllTabsWithStatus();
    expect(res.activeDocId).toBe('doc_r');
    expect(res.docs[id('doc_r')]?.title).toBe('good-backup');
    expect(res.recoveredFromBackup).toBe(true);
    expect(res.recoveredFromLiveDraftOnly).toBe(false);
  });

  it('recovers from the per-doc live draft when committed + backup are dead', () => {
    persistTabsManifest({ activeDocId: id('doc_l'), tabOrder: [id('doc_l')] });
    localStorage.setItem(
      docLiveKey(id('doc_l')),
      JSON.stringify(buildDoc('doc_l', 5000, 'live-only'))
    );

    const res = loadAllTabsWithStatus();
    expect(res.docs[id('doc_l')]?.title).toBe('live-only');
    expect(res.recoveredFromBackup).toBe(false);
    expect(res.recoveredFromLiveDraftOnly).toBe(true);
  });

  it('prefers a newer per-doc live draft over the committed body', () => {
    saveDocToLocalStorage(buildDoc('doc_n', 1000, 'committed'));
    persistTabsManifest({ activeDocId: id('doc_n'), tabOrder: [id('doc_n')] });
    localStorage.setItem(
      docLiveKey(id('doc_n')),
      JSON.stringify(buildDoc('doc_n', 9000, 'newer-live'))
    );

    const res = loadAllTabsWithStatus();
    expect(res.docs[id('doc_n')]?.title).toBe('newer-live');
    expect(res.recoveredFromBackup).toBe(false);
    expect(res.recoveredFromLiveDraftOnly).toBe(false);
  });
});

describe('Batch 2.2 — migration from the legacy single-doc format', () => {
  it('migrates a legacy doc into per-doc slots + manifest', () => {
    saveToLocalStorage(buildDoc('doc_legacy', 1000, 'pre-2.2')); // legacy slot only
    expect(readTabsManifest()).toBeNull();

    const res = loadAllTabsWithStatus();
    expect(res.migratedFromLegacy).toBe(true);
    expect(res.activeDocId).toBe('doc_legacy');
    expect(res.docs[id('doc_legacy')]?.title).toBe('pre-2.2');
    // Migration established the new format.
    expect(readTabsManifest()).toEqual({ activeDocId: 'doc_legacy', tabOrder: ['doc_legacy'] });
    expect(localStorage.getItem(docCommittedKey(id('doc_legacy')))).not.toBeNull();
  });

  it('a second boot after migration takes the manifest path (no re-migration)', () => {
    saveToLocalStorage(buildDoc('doc_m', 1000, 'once'));
    loadAllTabsWithStatus(); // migrates
    const res2 = loadAllTabsWithStatus(); // manifest now present
    expect(res2.migratedFromLegacy).toBe(false);
    expect(res2.docs[id('doc_m')]?.title).toBe('once');
  });

  it('carries the legacy recovery flag through migration', () => {
    saveToLocalStorage(buildDoc('doc_rec', 1000, 'one'));
    saveToLocalStorage(buildDoc('doc_rec', 2000, 'two')); // legacy backup ← one
    localStorage.setItem(STORAGE_KEYS.doc, '{ corrupt'); // legacy committed dead
    const res = loadAllTabsWithStatus();
    expect(res.migratedFromLegacy).toBe(true);
    expect(res.docs[id('doc_rec')]?.title).toBe('one');
    expect(res.recoveredFromBackup).toBe(true);
  });
});

describe('Batch 2.2 — empty + malformed states', () => {
  it('returns an empty result when nothing is stored', () => {
    const res = loadAllTabsWithStatus();
    expect(res.docs).toEqual({});
    expect(res.activeDocId).toBeNull();
    expect(res.tabOrder).toEqual([]);
    expect(res.migratedFromLegacy).toBe(false);
  });

  it('treats a malformed manifest as absent (falls through to legacy)', () => {
    localStorage.setItem(tabsManifestKey, '{ not json');
    saveToLocalStorage(buildDoc('doc_f', 1000, 'fallback'));
    const res = loadAllTabsWithStatus();
    expect(res.migratedFromLegacy).toBe(true);
    expect(res.docs[id('doc_f')]?.title).toBe('fallback');
  });

  it('drops a tab whose body was lost, keeping surviving tabs', () => {
    saveDocToLocalStorage(buildDoc('doc_a', 1000, 'A'));
    persistTabsManifest({ activeDocId: id('doc_a'), tabOrder: [id('doc_a'), id('doc_missing')] });
    const res = loadAllTabsWithStatus();
    expect(res.tabOrder).toEqual(['doc_a']);
    expect(res.activeDocId).toBe('doc_a');
    expect(res.docs[id('doc_missing')]).toBeUndefined();
  });

  it('falls back to the first surviving tab when the active body is lost', () => {
    saveDocToLocalStorage(buildDoc('doc_b', 1000, 'B'));
    persistTabsManifest({ activeDocId: id('doc_gone'), tabOrder: [id('doc_gone'), id('doc_b')] });
    const res = loadAllTabsWithStatus();
    expect(res.activeDocId).toBe('doc_b');
    expect(res.tabOrder).toEqual(['doc_b']);
  });
});

describe('Batch 2.2 — clearLocalStorage drops the new slots', () => {
  it('clears per-doc slots + manifest so a subsequent boot is empty', () => {
    persistActiveDoc(buildDoc('doc_c', 1000, 'clear-me'));
    expect(loadAllTabsWithStatus().activeDocId).toBe('doc_c');

    clearLocalStorage();
    const res = loadAllTabsWithStatus();
    expect(res.activeDocId).toBeNull();
    expect(res.docs).toEqual({});
    expect(localStorage.getItem(tabsManifestKey)).toBeNull();
    expect(localStorage.getItem(docCommittedKey(id('doc_c')))).toBeNull();
  });
});

describe('Batch 2.2 — store → scheduler → boot reload (smoke)', () => {
  beforeEach(() => {
    resetStoreForTest();
    localStorage.clear();
  });

  it('an edit + flush is reloadable through the multi-doc boot path', () => {
    seedEntity('Reloaded');
    flushPersist();
    const activeId = useDocumentStore.getState().doc.id;

    const res = loadAllTabsWithStatus();
    expect(res.activeDocId).toBe(activeId);
    expect(res.tabOrder).toEqual([activeId]);
    const reloaded = res.docs[activeId];
    expect(reloaded).toBeDefined();
    expect(Object.values(reloaded?.entities ?? {}).some((e) => e.title === 'Reloaded')).toBe(true);
  });

  it('dual-writes the legacy slot so a pre-2.2 build still boots', () => {
    seedEntity('DualWrite');
    flushPersist();
    const legacy = loadFromLocalStorage();
    expect(legacy).not.toBeNull();
    expect(Object.values(legacy?.entities ?? {}).some((e) => e.title === 'DualWrite')).toBe(true);
  });
});
