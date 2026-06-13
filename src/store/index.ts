import { create } from 'zustand';
import { evictOldestClosedTrees, readTabsManifest, removeDocBackup } from '@/domain/persistence';
import type { Revision } from '@/domain/revisions';
import { cancelPendingPersist } from '@/services/storage/persistDebounced';
import {
  readJSON,
  STORAGE_KEYS,
  setStorageErrorListener,
  writeJSON,
} from '@/services/storage/storage';
import { createDocumentSlice, documentDefaults } from './documentSlice';
import { createHistorySlice, historyDefaults } from './historySlice';
import { createRevisionsSlice, revisionsDefaults } from './revisionsSlice';
import type { RootStore } from './types';
import { createUISlice, uiDefaults } from './uiSlice';

export type { DocumentStore, RootStore } from './types';
export type {
  AnimationSpeed,
  AppMode,
  CausalityLabel,
  ContextMenuState,
  ContextMenuTarget,
  DefaultLayoutDirection,
  EdgePalette,
  EdgeRouting,
  LayoutMode,
  Selection,
  Theme,
  Toast,
  ToastKind,
} from './uiSlice';

export const useDocumentStore = create<RootStore>()((...a) => ({
  ...createDocumentSlice(...a),
  ...createUISlice(...a),
  ...createHistorySlice(...a),
  ...createRevisionsSlice(...a),
}));

// H1 — populate the revisions panel with the boot doc's history. The
// revisions slice can't do this from its own creator because `get().doc`
// resolves against the not-yet-final composed state; once the store is
// built, the action is safe to call.
useDocumentStore.getState().reloadRevisionsForActiveDoc();

// Surface storage failures (quota exceeded, disabled, private-mode quirks)
// to the user via a toast. The in-memory doc keeps working.
//
// Session 129 — quota mitigation. When the failure is QuotaExceeded
// (the dominant case in practice — typically triggered by an accumulated
// revision history on a long-running doc), the listener first tries to
// free space by halving each doc's per-doc revision list (keep newest
// half, drop oldest) and writing the trimmed map back. The next mutation
// retries the original write automatically because persistDebounced
// flushes again on the next mutation; success at that point yields a
// "storage was full, trimmed old revisions" toast so the user knows
// what happened. If even the trimmed write fails (extreme case — a
// single revision larger than the quota itself), the original error
// toast still surfaces.
//
// `quotaMitigationInFlight` keeps the listener re-entrant-safe: a
// retry-write that itself trips quota won't infinitely recurse through
// the listener.
let quotaMitigationInFlight = false;

/** Final-tier quota mitigation evicts at most this many of the oldest closed
 *  trees per trigger — small + conservative since it drops primary user data; the
 *  cascade re-fires (freeing more) if the next save still doesn't fit. */
const QUOTA_EVICT_BATCH = 5;

const tryTrimRevisionsForQuota = (): { trimmed: number; revisionsDropped: number } | null => {
  type RevisionsByDoc = Record<string, Revision[]>;
  const map = readJSON<RevisionsByDoc>(STORAGE_KEYS.revisions);
  if (!map || typeof map !== 'object') return null;
  let trimmedDocs = 0;
  let droppedRevisions = 0;
  const next: RevisionsByDoc = {};
  for (const [docId, list] of Object.entries(map)) {
    if (!Array.isArray(list) || list.length <= 1) {
      next[docId] = list;
      continue;
    }
    const keep = Math.max(1, Math.floor(list.length / 2));
    droppedRevisions += list.length - keep;
    if (keep < list.length) trimmedDocs += 1;
    // Revisions are newest-first; keep the newer half.
    next[docId] = list.slice(0, keep);
  }
  if (droppedRevisions === 0) return null;
  const ok = writeJSON(STORAGE_KEYS.revisions, next);
  if (!ok) return null;
  return { trimmed: trimmedDocs, revisionsDropped: droppedRevisions };
};

/**
 * Phase 6 quota mitigation, second tier — drop the backup slot of every
 * INACTIVE open tab (the active tab keeps all three slots). These backups
 * are the lowest-value per-doc data; the committed + live bodies of those
 * tabs remain, so nothing the user can see is lost. Returns how many
 * backups were actually freed.
 */
const tryDropInactiveTabBackups = (): number => {
  const manifest = readTabsManifest();
  if (!manifest) return 0;
  let dropped = 0;
  for (const id of manifest.tabOrder) {
    if (id === manifest.activeDocId) continue;
    if (removeDocBackup(id)) dropped += 1;
  }
  return dropped;
};

setStorageErrorListener((err) => {
  const store = useDocumentStore.getState();
  if (err.kind === 'quota' && !quotaMitigationInFlight) {
    quotaMitigationInFlight = true;
    try {
      const result = tryTrimRevisionsForQuota();
      if (result) {
        store.showToast(
          'info',
          `Browser storage was full — trimmed ${result.revisionsDropped} old revision${result.revisionsDropped === 1 ? '' : 's'} to make room.`
        );
        // Reload the in-memory revisions array so the panel reflects the
        // trim. `reloadRevisionsForActiveDoc` reads the same storage key.
        store.reloadRevisionsForActiveDoc();
        return;
      }
      // Second tier — drop inactive open tabs' backup slots before giving up
      // (lowest-value per-doc data; committed + live bodies remain).
      const droppedBackups = tryDropInactiveTabBackups();
      if (droppedBackups > 0) {
        store.showToast(
          'info',
          `Browser storage was full — freed space by dropping ${droppedBackups} inactive tab backup${droppedBackups === 1 ? '' : 's'}. Your open tabs are safe.`
        );
        return;
      }
      // Final tier (Session 185) — trimming revisions + dropping backups freed
      // nothing, so evict the oldest CLOSED trees (not open in any tab) to keep
      // the app saving. The only tier that drops a user's primary saved document,
      // so it's last, conservative (a small batch), and loud.
      const evicted = evictOldestClosedTrees(
        new Set(readTabsManifest()?.tabOrder ?? []),
        QUOTA_EVICT_BATCH
      );
      if (evicted > 0) {
        // The Start "All trees" library re-scans storage on this bump.
        useDocumentStore.setState((st) => ({ savedDocsVersion: st.savedDocsVersion + 1 }));
        store.showToast(
          'error',
          `Browser storage was full — removed your ${evicted} oldest closed tree${evicted === 1 ? '' : 's'} to keep saving. Open tabs are safe; export trees you want to keep.`
        );
        return;
      }
    } finally {
      quotaMitigationInFlight = false;
    }
    // Trim didn't help (no revisions to trim, or the trimmed write also
    // failed) — fall through to the generic toast so the user at least
    // knows their edits are in-memory only.
    const openTabs = readTabsManifest()?.tabOrder.length ?? 1;
    store.showToast(
      'error',
      openTabs > 1
        ? 'Browser storage is full. Close some tabs to free space — each open tab keeps its own saved copy — or export a doc to a file.'
        : "Browser storage is full and can't be freed automatically. Export to a file to free space."
    );
    return;
  }
  store.showToast('error', `Couldn't save to this browser: ${err.cause.message}`);
});

/**
 * Test-only helper. Clears localStorage, then merges in each slice's
 * data-only defaults so all subscribers see a clean root state. Actions
 * are not replaced — they were bound by the slice creators at module init.
 *
 * Adding a new data field to a slice only requires updating that slice's
 * `*Defaults()` factory; tests don't need to know about the new field.
 */
export const resetStoreForTest = (): void => {
  cancelPendingPersist();
  if (typeof globalThis.localStorage !== 'undefined') {
    globalThis.localStorage.clear();
  }
  useDocumentStore.setState({
    ...documentDefaults(),
    ...uiDefaults(),
    ...historyDefaults(),
    ...revisionsDefaults(),
  });
};
