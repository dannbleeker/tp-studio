import { create } from 'zustand';
import { createDocumentSlice, documentDefaults } from './documentSlice';
import { createHistorySlice, historyDefaults } from './historySlice';
import type { RootStore } from './types';
import { createUISlice, uiDefaults } from './uiSlice';

export type { DocumentStore, RootStore } from './types';
export type {
  ContextMenuState,
  ContextMenuTarget,
  Selection,
  Theme,
  Toast,
  ToastKind,
} from './uiSlice';

export const useDocumentStore = create<RootStore>()((...a) => ({
  ...createDocumentSlice(...a),
  ...createUISlice(...a),
  ...createHistorySlice(...a),
}));

/**
 * Test-only helper. Clears localStorage, then merges in each slice's
 * data-only defaults so all subscribers see a clean root state. Actions
 * are not replaced — they were bound by the slice creators at module init.
 *
 * Adding a new data field to a slice only requires updating that slice's
 * `*Defaults()` factory; tests don't need to know about the new field.
 */
export const resetStoreForTest = (): void => {
  if (typeof globalThis.localStorage !== 'undefined') {
    globalThis.localStorage.clear();
  }
  useDocumentStore.setState({
    ...documentDefaults(),
    ...uiDefaults(),
    ...historyDefaults(),
  });
};
