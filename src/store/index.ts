import { create } from 'zustand';
import {
  dropOrphanedRevisions,
  evictOldestClosedTrees,
  readTabsManifest,
  removeDocBackup,
} from '@/domain/persistence';
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
import { createJourneySlice, journeyDefaults } from './journeySlice';
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
  Locale,
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
  ...createJourneySlice(...a),
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

/**
 * ONE user save produces several independent `setItem` calls — 2 for a live-draft
 * write (per keystroke) and 4 for a debounced commit (per-doc committed + backup,
 * plus the legacy dual-write). Each failure invokes this listener separately, and
 * `quotaMitigationInFlight` used to be cleared in a `finally`, i.e. before the
 * next one arrived. So the cascade ran once PER FAILED WRITE, not once per save:
 * with tiers 1 and 2 exhausted, typing a single character evicted 10 closed trees
 * and a commit evicted 20 — silently, because `showToast` dedupes on
 * `(kind, message)` and the message was byte-identical every time.
 *
 * Clearing the latch on a task boundary instead collapses one save's burst into
 * exactly one mitigation, while still letting the NEXT save re-fire the cascade —
 * which is the documented intent ("frees more if the next save still doesn't fit").
 */
const releaseQuotaLatch = (): void => {
  setTimeout(() => {
    quotaMitigationInFlight = false;
  }, 0);
};

/** Final-tier quota mitigation evicts at most this many of the oldest closed
 *  trees per trigger — small + conservative since it drops primary user data; the
 *  cascade re-fires (freeing more) if the next save still doesn't fit. */
const QUOTA_EVICT_BATCH = 5;

/**
 * Floor between two tier-3 evictions. The per-save latch above is not enough on
 * its own: typing is a stream of saves, and one batch per keystroke is still a
 * tree-shredder. Tier 3 is the only tier that destroys primary user data, so it
 * gets a wall-clock floor as well — worst case one batch of 5 per interval, each
 * announced.
 */
const QUOTA_EVICT_COOLDOWN_MS = 10_000;
let lastEvictionAt = 0;
/** Running total, so the eviction toast differs each time and can't be swallowed
 *  by `showToast`'s `(kind, message)` dedupe — which is how dozens of trees
 *  disappeared behind a single notification. */
let evictedThisSession = 0;

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
      // Tier 1a — revision history for docs that no longer exist. Free, in the
      // sense that nothing reachable is lost, so it runs before anything else.
      const orphaned = dropOrphanedRevisions(new Set(store.tabOrder));
      if (orphaned > 0) {
        store.showToast(
          'info',
          `Browser storage was full — reclaimed the history of ${orphaned} deleted tree${orphaned === 1 ? '' : 's'}.`
        );
        store.reloadRevisionsForActiveDoc();
        return;
      }
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
      // Use the in-memory tab order (the source of truth) rather than re-reading
      // the persisted manifest, so a momentarily-stale manifest can't mark an open
      // tab as evictable — and it matches what `forgetClosedDocs` reads.
      const now = Date.now();
      if (now - lastEvictionAt >= QUOTA_EVICT_COOLDOWN_MS) {
        const evicted = evictOldestClosedTrees(new Set(store.tabOrder), QUOTA_EVICT_BATCH);
        if (evicted > 0) {
          lastEvictionAt = now;
          evictedThisSession += evicted;
          // The Start "All trees" library re-scans storage on this bump.
          useDocumentStore.setState((st) => ({ savedDocsVersion: st.savedDocsVersion + 1 }));
          store.showToast(
            'error',
            `Browser storage was full — removed your ${evicted} oldest closed tree${evicted === 1 ? '' : 's'} to keep saving (${evictedThisSession} so far). Open tabs are safe; export trees you want to keep.`
          );
          return;
        }
      }
    } finally {
      releaseQuotaLatch();
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
  // Quota-mitigation state is module-level and deliberately outlives a single
  // save — the latch clears on a task boundary and the eviction floor is
  // wall-clock. Neither survives into the next TEST, where each case is its own
  // storage-pressure scenario.
  quotaMitigationInFlight = false;
  lastEvictionAt = 0;
  evictedThisSession = 0;
  if (typeof globalThis.localStorage !== 'undefined') {
    globalThis.localStorage.clear();
  }
  useDocumentStore.setState({
    ...documentDefaults(),
    ...uiDefaults(),
    ...historyDefaults(),
    ...revisionsDefaults(),
    ...journeyDefaults(),
    // Auto-snapshot is a time-based background feature (fires on edit-commit once
    // an interval has elapsed). Off in tests so ordinary edits don't emit
    // surprise 'Auto' revisions; the auto-snapshot suite enables it explicitly.
    autoSnapshot: false,
  });
};
