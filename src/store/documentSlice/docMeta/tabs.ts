/**
 * The multi-doc tab engine + whole-document swap/lifecycle actions, split out
 * of `docMetaSlice.ts`. Owns which document/tab is active: open/switch/close/
 * reorder/duplicate tabs, the saved-tree library (open/delete by id), and the
 * full-document swaps (`setDocument` / `newDocument`).
 *
 * These manage history (park/restore per-tab stacks, or a single undo entry on
 * a swap) directly rather than via `applyDocChange`, so the two helpers used
 * only here — `performDocumentSwap` and `activeDocEphemeralReset` — live here.
 */

import { createDocument } from '@/domain/factory';
import { newDocumentId } from '@/domain/ids';
import {
  importFromJSON,
  loadSavedDoc,
  persistTabsManifest,
  removeDocFromStorage,
  saveDocToLocalStorage,
} from '@/domain/persistence';
import type { DiagramType, DocumentId, TPDocument } from '@/domain/types';
import { flushPersist, persistDebounced } from '@/services/storage/persistDebounced';
import { activeDocState, setActiveDoc } from '../../activeDoc';
import { applyTabSwitchHistory, pushHistoryEntry, stashHistory } from '../../historySlice';
import { autoSnapshotOutgoing } from '../../revisionsSlice';
import { currentDoc } from '../../selectors';
import { speculationDefaults } from '../../uiSlice/speculationSlice';
import { stripLinksToDoc } from '../linkPrune';
import type { DocMetaFactoryDeps } from './shared';

export type TabActions = {
  setDocument: (doc: TPDocument) => void;
  newDocument: (diagramType: DiagramType) => void;

  // ── Multi-doc tabs (Phase 5, Batch 5.1) — the tab engine ─────────────
  /** Open `doc` in a NEW tab and activate it. The current tab stays open;
   *  its undo/redo stacks are parked in `historyByDoc`. */
  openTab: (doc: TPDocument) => void;
  /** Switch the active tab to `id` (no-op if already active or unknown).
   *  Swaps the live undo/redo stacks (via `applyTabSwitchHistory`) and
   *  drops any speculation overlay (locked decision #5). */
  switchTab: (id: DocumentId) => void;
  /** Close tab `id`. If it was active, activates the right-hand neighbour
   *  (clamped); if it was the last tab, opens a fresh blank CRT so there is
   *  never zero tabs. Session 184 — the closed doc's body STAYS in storage
   *  (reopenable from the Start "All trees" library via `openSavedDoc`); only
   *  `deleteSavedDoc` / "Forget closed documents" removes it. */
  closeTab: (id: DocumentId) => void;
  /** Reorder the tab strip. `order` must be a permutation of `tabOrder`;
   *  a non-permutation is ignored. */
  reorderTabs: (order: DocumentId[]) => void;
  /** Duplicate tab `id` into a new tab (fresh doc id, deep content copy,
   *  `(copy)` appended to the title) and activate it (locked decision #4). */
  duplicateTab: (id: DocumentId) => void;
  /** Session 138 (Batch 5.3) — open `doc` honouring the
   *  `openDocsInNewTab` preference: a NEW tab when enabled (default,
   *  returns `true`), otherwise replace the active document via
   *  `setDocument` (returns `false`). The boolean lets a caller tailor
   *  its post-load toast — a new tab is "undone" by closing it, so an
   *  "Undo" that restores the previous doc only makes sense in replace
   *  mode. */
  openDocInTab: (doc: TPDocument) => boolean;
  /** Session 184 — open a saved tree by id from the Start library: switches to
   *  it if already open, else loads its body from storage into a new tab.
   *  Returns true if it switched/opened, or false (with a toast) if the tree was
   *  already deleted — so callers that then navigate can skip a dead select. */
  openSavedDoc: (id: DocumentId) => boolean;
  /** Session 184 — permanently delete a saved tree (open or closed): closes its
   *  tab if open, removes its body from storage, and bumps `savedDocsVersion`. */
  deleteSavedDoc: (id: DocumentId) => void;
};

/**
 * The per-doc *ephemeral* UI state that must reset whenever the active
 * document changes. Every field keys off the *previous* doc's
 * entities/edges — the selection's ids, the editing-entity id, the
 * walkthrough's targetIds, the speculation overlay's entity→state map, and
 * `searchMatchIndex` (an index into the active doc's match list) — so
 * carrying any of it into a different document is a bug. Each doc-change
 * action (`setDocument` / `newDocument` / `openTab` / `switchTab` /
 * `closeTab`) spreads this, so a new action physically can't forget one.
 *
 * History (`past` / `future`) is deliberately NOT here — each caller swaps
 * or pushes it differently (tab park/restore vs. a single undo entry).
 */
const activeDocEphemeralReset = () => ({
  selection: { kind: 'none' as const },
  editingEntityId: null,
  walkthrough: { kind: 'closed' as const },
  searchMatchIndex: 0,
  // Compare / side-by-side are per-doc views of a revision in the CURRENT doc's
  // history. A doc swap must clear them, or the entering tab is stuck in a ghost
  // compare state: its revisions no longer contain the compared id, so the
  // banner renders no diff (and no way to exit) while the canvas stays locked.
  compareRevisionId: null,
  sideBySideRevisionId: null,
  // Session 183 — focusing any document leaves the Start (workspace) surface.
  // Centralised here so every doc-entry path (the palette "New diagram", the
  // diagram / template pickers, a Start tree card, the hero "Build a CRT")
  // exits Start without each call site having to remember to.
  startSection: null,
  ...speculationDefaults(),
});

export function createTabActions({ get, set }: DocMetaFactoryDeps): TabActions {
  // Shared "swap the active document" sequence used by `setDocument` and
  // `newDocument`: snapshot the outgoing doc as a revision (suppressed on a
  // restore swap; skipped for an empty fresh-boot doc), persist the incoming
  // doc synchronously (explicit user intent), rebuild the single-tab
  // map/order around it + reset ephemeral UI state, push the outgoing doc onto
  // history, and refresh the revisions panel. Extracted so the two callers
  // can't drift out of sync.
  const performDocumentSwap = (doc: TPDocument, reason: string): void => {
    const prev = currentDoc(get());
    autoSnapshotOutgoing(prev, reason);
    persistDebounced(doc);
    flushPersist();
    set({
      ...setActiveDoc(get(), doc),
      ...activeDocEphemeralReset(),
      past: pushHistoryEntry(get().past, { doc: prev, t: Date.now() }),
      future: [],
    });
    get().reloadRevisionsForActiveDoc();
  };

  return {
    setDocument: (doc) => {
      performDocumentSwap(doc, 'document swap');
    },

    // Session 184 — the Start "All trees" library. `openSavedDoc` reopens any
    // saved tree by id (switch if already open, else load its body from
    // storage into a new tab); `deleteSavedDoc` permanently removes one.
    openSavedDoc: (id) => {
      const state = get();
      if (state.docs[id]) {
        state.switchTab(id);
        return true;
      }
      const doc = loadSavedDoc(id);
      if (doc) {
        state.openDocInTab(doc);
        return true;
      }
      state.showToast('info', 'That tree is no longer available — it was deleted.');
      return false;
    },
    deleteSavedDoc: (id) => {
      // Closing an open tab clears `startSection` (it exits to the editor), but a
      // delete from the Start library must STAY on Start — snapshot + restore it.
      const section = get().startSection;
      if (get().docs[id]) get().closeTab(id);
      removeDocFromStorage(id);
      // The doc is gone for good now (unlike a plain close, which is reopenable),
      // so sweep cross-doc links pointing INTO it out of the still-open tabs and
      // persist those — otherwise they'd linger as dead chips and ride along in
      // exports. closeTab no longer sweeps, so this covers both open + closed docs.
      const { docs, activeDocId, doc } = get();
      const { docs: sweptDocs, changed } = stripLinksToDoc(docs, id);
      for (const d of changed) saveDocToLocalStorage(d);
      set({
        docs: sweptDocs,
        doc: sweptDocs[activeDocId] ?? doc,
        savedDocsVersion: get().savedDocsVersion + 1,
        startSection: section,
      });
    },

    newDocument: (diagramType) => {
      const base = createDocument(diagramType);
      // FL-TO3: seed the fresh doc with the user's preferred layout
      // direction when set. `'auto'` falls back to the diagram-type
      // default (BT/TB/etc.). Manual-layout diagrams (EC) ignore the
      // field at render time, so seeding it is harmless there.
      const pref = get().defaultLayoutDirection;
      const doc =
        pref && pref !== 'auto'
          ? { ...base, layoutConfig: { ...(base.layoutConfig ?? {}), direction: pref } }
          : base;
      performDocumentSwap(doc, `new ${diagramType} document`);
      // Session 78: open the creation wizard panel when the diagram
      // type has one AND the user hasn't turned it off. Goal Tree +
      // EC are the two that have a wizard today.
      //
      // Session 135 / spec gap #9 Phase 1C — Guided mode forces the
      // wizards to surface even when the per-diagram suppress flag
      // is off. The user explicitly opted into the hand-holding flow
      // by switching to Guided; honour that over their dismissed-by-
      // default state. Expert / Workshop / Presentation keep the
      // user's persisted flag as-is.
      const guidedOverride = get().appMode === 'guided';
      if (diagramType === 'goalTree' && (get().showGoalTreeWizard || guidedOverride)) {
        get().openCreationWizard('goalTree');
      } else if (diagramType === 'ec' && (get().showECWizard || guidedOverride)) {
        get().openCreationWizard('ec');
      } else if (diagramType === 'crt' && (get().showCRTWizard || guidedOverride)) {
        // Session 136 — CRT wizard parallel to GT / EC. Walks the
        // user through capturing the first three UDEs; the causal
        // chain back to a root cause is the user's work.
        get().openCreationWizard('crt');
      } else {
        // Closing covers the case where a wizard from a previous doc
        // was open; switching to a non-wizardable diagram clears it.
        get().closeCreationWizard();
      }
    },

    // ── Multi-doc tabs (Phase 5, Batch 5.1) — the tab engine ─────────────
    openTab: (doc) => {
      const state = get();
      // Persist the outgoing tab before leaving it: flush any pending
      // debounced write, then force-commit its body — a never-edited tab
      // has no pending write to flush, and its body must be in storage for
      // a reload to restore it (Batch 5.4).
      flushPersist();
      saveDocToLocalStorage(state.doc);
      const tabOrder = [...state.tabOrder, doc.id];
      set({
        doc,
        docs: { ...state.docs, [doc.id]: doc },
        activeDocId: doc.id,
        tabOrder,
        // Park the outgoing tab's live stacks; the new tab starts empty.
        historyByDoc: stashHistory(state.historyByDoc, state.activeDocId, {
          past: state.past,
          future: state.future,
        }),
        past: [],
        future: [],
        ...activeDocEphemeralReset(),
      });
      saveDocToLocalStorage(doc);
      persistTabsManifest({ activeDocId: doc.id, tabOrder });
      get().reloadRevisionsForActiveDoc();
    },

    switchTab: (id) => {
      const state = get();
      if (id === state.activeDocId) return;
      const target = state.docs[id];
      if (!target) return;
      // Persist the outgoing tab (force-commit, not just flush pending) so
      // a reload restores it (Batch 5.4).
      flushPersist();
      saveDocToLocalStorage(state.doc);
      // Park the leaving tab's live stacks; promote the entering tab's.
      const swapped = applyTabSwitchHistory(
        state.historyByDoc,
        state.activeDocId,
        { past: state.past, future: state.future },
        id
      );
      set({
        doc: target,
        activeDocId: id,
        historyByDoc: swapped.historyByDoc,
        past: swapped.past,
        future: swapped.future,
        ...activeDocEphemeralReset(),
      });
      persistTabsManifest({ activeDocId: id, tabOrder: state.tabOrder });
      get().reloadRevisionsForActiveDoc();
    },

    closeTab: (id) => {
      const state = get();
      if (!state.docs[id]) return;
      const idx = state.tabOrder.indexOf(id);
      const remaining = state.tabOrder.filter((t) => t !== id);
      const { [id]: _closedDoc, ...docsRest } = state.docs;
      const { [id]: _closedHist, ...historyRest } = state.historyByDoc;
      flushPersist();

      // Session 184 — closing a tab keeps the doc's body in storage (reopenable
      // from the Start "All trees" library), so cross-doc links pointing INTO it
      // are left intact and reconnect on reopen; the inspector renders them as
      // muted "tab closed" chips meanwhile. Only an explicit delete forgets the
      // doc and sweeps those links (see `deleteSavedDoc`).

      // Last tab closed → never zero tabs; replace with a fresh blank CRT.
      if (remaining.length === 0) {
        const fresh = createDocument('crt');
        set({
          ...activeDocState(fresh),
          historyByDoc: {},
          past: [],
          future: [],
          ...activeDocEphemeralReset(),
        });
        saveDocToLocalStorage(fresh);
        persistTabsManifest({ activeDocId: fresh.id, tabOrder: [fresh.id] });
        // Session 184 — closing a tab no longer deletes the doc's body. It
        // stays in storage so the Start "All trees" library can reopen it;
        // only an explicit delete / "Forget closed documents" removes it.
        get().reloadRevisionsForActiveDoc();
        return;
      }

      // Closing a background tab → the active tab is untouched.
      if (id !== state.activeDocId) {
        const liveActive = docsRest[state.activeDocId] ?? state.doc;
        set({ doc: liveActive, docs: docsRest, tabOrder: remaining, historyByDoc: historyRest });
        persistTabsManifest({ activeDocId: state.activeDocId, tabOrder: remaining });
        // Session 184 — keep the closed doc's body (reopenable from the library).
        return;
      }

      // Closing the active tab → activate the right-hand neighbour (clamped
      // to the new last tab when the closed tab was rightmost).
      const nextActiveId = remaining[Math.min(idx, remaining.length - 1)];
      const target = nextActiveId ? docsRest[nextActiveId] : undefined;
      if (!nextActiveId || !target) return;
      const restored = historyRest[nextActiveId] ?? { past: [], future: [] };
      const { [nextActiveId]: _nowLive, ...historyParked } = historyRest;
      set({
        doc: target,
        docs: docsRest,
        activeDocId: nextActiveId,
        tabOrder: remaining,
        historyByDoc: historyParked,
        past: restored.past,
        future: restored.future,
        ...activeDocEphemeralReset(),
      });
      persistTabsManifest({ activeDocId: nextActiveId, tabOrder: remaining });
      // Session 184 — keep the closed doc's body (reopenable from the library).
      get().reloadRevisionsForActiveDoc();
    },

    reorderTabs: (order) => {
      const state = get();
      // Ignore anything that isn't a permutation of the current open set.
      if (order.length !== state.tabOrder.length || !order.every((tid) => state.docs[tid])) {
        return;
      }
      set({ tabOrder: order });
      persistTabsManifest({ activeDocId: state.activeDocId, tabOrder: order });
    },

    duplicateTab: (id) => {
      const src = get().docs[id];
      if (!src) return;
      // Deep copy via a JSON round-trip (validates + clones nested maps),
      // then a fresh id + `(copy)` title so the duplicate is fully
      // independent — its own history, persistence, share link (decision #4).
      const cloned = importFromJSON(JSON.stringify(src));
      const copy: TPDocument = {
        ...cloned,
        id: newDocumentId(),
        title: `${src.title} (copy)`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      get().openTab(copy);
    },

    openDocInTab: (doc) => {
      // Decision #6 — loaded documents open in a new tab by default; the
      // `openDocsInNewTab` pref lets users restore the pre-tabs "replace
      // the active document" behavior. Returns whether a new tab opened.
      if (get().openDocsInNewTab) {
        get().openTab(doc);
        return true;
      }
      get().setDocument(doc);
      return false;
    },
  };
}
