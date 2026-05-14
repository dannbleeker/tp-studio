import { cancelPendingPersist } from '@/services/persistDebounced';
import { setStorageErrorListener } from '@/services/storage';
import { create } from 'zustand';
import { createDocumentSlice, documentDefaults } from './documentSlice';
import { createHistorySlice, historyDefaults } from './historySlice';
import { createRevisionsSlice, revisionsDefaults } from './revisionsSlice';
import type { RootStore } from './types';
import { createUISlice, uiDefaults } from './uiSlice';
import { createWorkspaceSlice } from './workspaceSlice';

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
  ...createWorkspaceSlice(...a),
}));

// FL-EX8 — seed the workspace from whatever boot doc the
// docMetaSlice loaded from localStorage. We do this after `create()`
// because the workspace slice's defaults are a placeholder; the real
// initial workspace mirrors the active doc.
{
  const boot = useDocumentStore.getState().doc;
  useDocumentStore.setState({
    workspace: {
      tabs: [{ id: boot.id, title: boot.title }],
      activeTabId: boot.id,
      inactiveDocs: {},
      inactiveHistory: {},
    },
  });
}

// H1 — populate the revisions panel with the boot doc's history. The
// revisions slice can't do this from its own creator because `get().doc`
// resolves against the not-yet-final composed state; once the store is
// built, the action is safe to call.
useDocumentStore.getState().reloadRevisionsForActiveDoc();

// Surface storage failures (quota exceeded, disabled, private-mode quirks)
// to the user via a toast. The in-memory doc keeps working.
setStorageErrorListener((err) => {
  useDocumentStore.getState().showToast('error', `Couldn't save to this browser: ${err.message}`);
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
  const docDefaults = documentDefaults();
  useDocumentStore.setState({
    ...docDefaults,
    ...uiDefaults(),
    ...historyDefaults(),
    ...revisionsDefaults(),
    // FL-EX8 — keep the workspace's first tab in sync with the
    // fresh test doc's id rather than the standalone `workspaceDefaults()`
    // (which would create its own doc and end up with a mismatched tab id).
    workspace: {
      tabs: [{ id: docDefaults.doc.id, title: docDefaults.doc.title }],
      activeTabId: docDefaults.doc.id,
      inactiveDocs: {},
      inactiveHistory: {},
    },
  });
};
