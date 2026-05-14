/**
 * Multi-document workspace (FL-EX8) — v0, in-memory only.
 *
 * Adds a tabs concept on top of the existing single-doc store: the
 * **active tab's doc still lives in `state.doc`** (every existing reader
 * keeps working unchanged), and inactive tabs' docs live in
 * `workspace.inactiveDocs`. Switching tabs is "save the active doc into
 * the inactive slot for the previous tab, then load the new tab's doc
 * into `state.doc`."
 *
 * Why in-memory: per-tab localStorage persistence is a separate, larger
 * project (each tab needs its own STORAGE_KEY, the boot flow needs to
 * load N docs instead of 1, the live-draft / backup scheme needs to
 * track which tab each draft belongs to, etc.). Shipping the UX first
 * lets the user evaluate the feature without committing to the
 * persistence overhead — if the workspace feels good, we'll wire
 * persistence in a follow-up. If it doesn't, this whole branch reverts
 * cleanly.
 *
 * What DOES persist: the **active tab's doc** continues to round-trip
 * through `persistDebounced` exactly as before. So a user with a single
 * tab open experiences zero behavioral change. The multi-tab session
 * is lost on reload (back to single-doc, the existing localStorage
 * slot) — clearly documented in the New tab… palette command's hint.
 *
 * History / undo: tab switches do NOT push history entries — they're
 * navigations, not document mutations. Each tab keeps its own undo
 * stack via the existing `past` / `future` slots in HistorySlice
 * (which we also swap on tab switch — see `_swapHistoryFor`).
 */
import { createDocument } from '@/domain/factory';
import type { DiagramType, DocumentId, TPDocument } from '@/domain/types';
import { flushPersist, persistDebounced } from '@/services/persistDebounced';
import type { StateCreator } from 'zustand';
import type { RootStore } from './types';

export type WorkspaceTab = {
  /** Mirrors the tab's doc's `id`. The tab and the doc share the same
   *  identifier so switching is straightforward. */
  id: DocumentId;
  /** Cached title so the tab bar can render without diving into the
   *  inactive doc on every render. Updated by `syncActiveTabTitle`
   *  when the active tab's title changes via `setTitle`. */
  title: string;
};

/** Per-tab undo stacks. The active tab's stacks live in `state.past` /
 *  `state.future`; we capture the inactive ones here so switching back
 *  restores the previous tab's undo timeline. */
type InactiveHistoryStacks = {
  past: { doc: TPDocument; t: number }[];
  future: { doc: TPDocument; t: number }[];
};

export type WorkspaceSlice = {
  workspace: {
    tabs: WorkspaceTab[];
    /** Id of the currently-active tab. Always points at a valid tab —
     *  we guarantee at least one tab exists at all times. */
    activeTabId: DocumentId;
    /** In-memory doc cache for non-active tabs. Excludes the active
     *  tab (its doc is in `state.doc`). */
    inactiveDocs: Record<string, TPDocument>;
    /** Per-tab undo stacks for non-active tabs. Excludes the active
     *  tab (its stacks are in `state.past` / `state.future`). */
    inactiveHistory: Record<string, InactiveHistoryStacks>;
  };

  /** Open a new tab with a fresh document of the given diagram type.
   *  Switches to the new tab. The current tab's doc + undo stack get
   *  archived into `inactiveDocs` / `inactiveHistory`. */
  openNewTab: (diagramType: DiagramType) => void;

  /** Switch to an existing tab. No-op when the target is already
   *  active. Saves the current `state.doc` / `past` / `future` into
   *  the inactive slots, then loads the target's slots into the
   *  active state. */
  switchTab: (id: DocumentId) => void;

  /** Close a tab. If it was active, switches to a sibling. No-op if
   *  this would close the last remaining tab (we always keep at least
   *  one — the existing single-doc behavior is the floor). */
  closeTab: (id: DocumentId) => void;

  /** Refresh the active tab's cached title from `state.doc.title`.
   *  Called by `setTitle` so the tab bar updates live as the user
   *  types. */
  syncActiveTabTitle: () => void;
};

export type WorkspaceDataKeys = 'workspace';

/** Test-only — workspaceDefaults() yields a clean single-tab state
 *  pointing at a freshly-created CRT document. Used in
 *  `resetStoreForTest` so each test starts from a known workspace. */
export const workspaceDefaults = (): Pick<WorkspaceSlice, WorkspaceDataKeys> => {
  const doc = createDocument('crt');
  return {
    workspace: {
      tabs: [{ id: doc.id, title: doc.title }],
      activeTabId: doc.id,
      inactiveDocs: {},
      inactiveHistory: {},
    },
  };
};

/** Build the boot-time workspace from the already-loaded `initialDoc`.
 *  Called once at store construction so the first tab is whatever the
 *  user had open on their last session. */
export const workspaceForBootDoc = (
  initialDoc: TPDocument
): Pick<WorkspaceSlice, WorkspaceDataKeys> => ({
  workspace: {
    tabs: [{ id: initialDoc.id, title: initialDoc.title }],
    activeTabId: initialDoc.id,
    inactiveDocs: {},
    inactiveHistory: {},
  },
});

export const createWorkspaceSlice: StateCreator<RootStore, [], [], WorkspaceSlice> = (
  set,
  get
) => ({
  // Placeholder — overwritten by the boot wiring in `store/index.ts`
  // which calls `workspaceForBootDoc(initialDoc)`. The defaults here
  // are only used by `resetStoreForTest`, which provides its own
  // workspace via `workspaceDefaults()`.
  workspace: {
    tabs: [],
    activeTabId: '' as DocumentId,
    inactiveDocs: {},
    inactiveHistory: {},
  },

  openNewTab: (diagramType) => {
    const state = get();
    const newDoc = createDocument(diagramType);
    // Seed the new doc's layout direction from the user's preference,
    // matching the standalone `newDocument` flow.
    const pref = state.defaultLayoutDirection;
    const doc =
      pref && pref !== 'auto'
        ? { ...newDoc, layoutConfig: { ...(newDoc.layoutConfig ?? {}), direction: pref } }
        : newDoc;

    // Archive the current tab's doc + undo stack into the workspace
    // before we overwrite `state.doc`.
    const prevTabId = state.workspace.activeTabId;
    const archivedDocs = { ...state.workspace.inactiveDocs, [prevTabId]: state.doc };
    const archivedHistory = {
      ...state.workspace.inactiveHistory,
      [prevTabId]: { past: state.past, future: state.future },
    };

    // The active tab is the new one; remove it from the inactive maps
    // if it somehow already existed (it shouldn't — fresh id from
    // createDocument).
    delete archivedDocs[doc.id];
    delete archivedHistory[doc.id];

    // Persist the new active doc as today — single-doc localStorage
    // round-trip is preserved for the active tab only.
    persistDebounced(doc);
    flushPersist();

    set({
      doc,
      selection: { kind: 'none' },
      editingEntityId: null,
      past: [],
      future: [],
      workspace: {
        tabs: [...state.workspace.tabs, { id: doc.id, title: doc.title }],
        activeTabId: doc.id,
        inactiveDocs: archivedDocs,
        inactiveHistory: archivedHistory,
      },
    });
    // The revisions panel is keyed by the active doc id; refresh.
    get().reloadRevisionsForActiveDoc();

    // Session 78 — open the creation wizard if the new diagram type
    // has one AND the user hasn't opted out. Matches `newDocument`.
    if (diagramType === 'goalTree' && get().showGoalTreeWizard) {
      get().openCreationWizard('goalTree');
    } else if (diagramType === 'ec' && get().showECWizard) {
      get().openCreationWizard('ec');
    } else {
      get().closeCreationWizard();
    }
  },

  switchTab: (id) => {
    const state = get();
    if (state.workspace.activeTabId === id) return;
    const target = state.workspace.inactiveDocs[id];
    if (!target) {
      // The tab list is supposed to mirror the inactive-docs map for
      // every non-active id; if we got here we have a programming
      // error. Bail rather than corrupt state.
      return;
    }
    const prevTabId = state.workspace.activeTabId;
    // Snapshot current → inactive, then activate target.
    const inactiveDocs = { ...state.workspace.inactiveDocs };
    inactiveDocs[prevTabId] = state.doc;
    delete inactiveDocs[id];
    const inactiveHistory = { ...state.workspace.inactiveHistory };
    inactiveHistory[prevTabId] = { past: state.past, future: state.future };
    const restored = inactiveHistory[id] ?? { past: [], future: [] };
    delete inactiveHistory[id];

    persistDebounced(target);
    flushPersist();

    set({
      doc: target,
      selection: { kind: 'none' },
      editingEntityId: null,
      past: restored.past,
      future: restored.future,
      workspace: {
        ...state.workspace,
        activeTabId: id,
        inactiveDocs,
        inactiveHistory,
      },
    });
    get().reloadRevisionsForActiveDoc();
  },

  closeTab: (id) => {
    const state = get();
    if (state.workspace.tabs.length <= 1) return; // floor at one tab
    const closingActive = state.workspace.activeTabId === id;
    const remaining = state.workspace.tabs.filter((t) => t.id !== id);

    if (!closingActive) {
      // Closing an inactive tab — just drop its archived doc + history.
      const inactiveDocs = { ...state.workspace.inactiveDocs };
      delete inactiveDocs[id];
      const inactiveHistory = { ...state.workspace.inactiveHistory };
      delete inactiveHistory[id];
      set({
        workspace: {
          ...state.workspace,
          tabs: remaining,
          inactiveDocs,
          inactiveHistory,
        },
      });
      return;
    }

    // Closing the active tab — pick a sibling to activate. Prefer the
    // tab to the right of the closing one (matches most browser tab
    // close behavior); fall back to the leftmost.
    const closingIdx = state.workspace.tabs.findIndex((t) => t.id === id);
    const fallbackIdx = Math.min(closingIdx, remaining.length - 1);
    const nextTab = remaining[fallbackIdx];
    if (!nextTab) return;
    const nextDoc = state.workspace.inactiveDocs[nextTab.id];
    if (!nextDoc) return; // shouldn't happen — inactive maps must mirror tabs
    const inactiveDocs = { ...state.workspace.inactiveDocs };
    delete inactiveDocs[nextTab.id];
    const inactiveHistory = { ...state.workspace.inactiveHistory };
    const restored = inactiveHistory[nextTab.id] ?? { past: [], future: [] };
    delete inactiveHistory[nextTab.id];

    persistDebounced(nextDoc);
    flushPersist();

    set({
      doc: nextDoc,
      selection: { kind: 'none' },
      editingEntityId: null,
      past: restored.past,
      future: restored.future,
      workspace: {
        ...state.workspace,
        tabs: remaining,
        activeTabId: nextTab.id,
        inactiveDocs,
        inactiveHistory,
      },
    });
    get().reloadRevisionsForActiveDoc();
  },

  syncActiveTabTitle: () => {
    const state = get();
    const { activeTabId, tabs } = state.workspace;
    const activeIdx = tabs.findIndex((t) => t.id === activeTabId);
    if (activeIdx === -1) return;
    const liveTitle = state.doc.title;
    if (tabs[activeIdx]?.title === liveTitle) return;
    const nextTabs = tabs.slice();
    nextTabs[activeIdx] = { ...nextTabs[activeIdx], title: liveTitle } as WorkspaceTab;
    set({ workspace: { ...state.workspace, tabs: nextTabs } });
  },
});
