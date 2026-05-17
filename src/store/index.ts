import { create } from 'zustand';
import type { Revision } from '@/domain/revisions';
import { cancelPendingPersist } from '@/services/persistDebounced';
import { readJSON, STORAGE_KEYS, setStorageErrorListener, writeJSON } from '@/services/storage';
import { createDocumentSlice, documentDefaults } from './documentSlice';
import { createHistorySlice, historyDefaults } from './historySlice';
import { createRevisionsSlice, revisionsDefaults } from './revisionsSlice';
import type { RootStore } from './types';
import { createUISlice, uiDefaults } from './uiSlice';

export type { DocumentStore, RootStore } from './types';
export type {
  AnimationSpeed,
  CausalityLabel,
  ContextMenuState,
  ContextMenuTarget,
  DefaultLayoutDirection,
  EdgePalette,
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
    } finally {
      quotaMitigationInFlight = false;
    }
    // Trim didn't help (no revisions to trim, or the trimmed write also
    // failed) — fall through to the generic toast so the user at least
    // knows their edits are in-memory only.
    store.showToast(
      'error',
      "Browser storage is full and can't be freed automatically. Export to a file or close other tabs to free space."
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
