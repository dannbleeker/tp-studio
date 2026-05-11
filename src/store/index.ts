import { create } from 'zustand';
import { type DocumentSlice, createDocumentSlice } from './documentSlice';
import { type HistorySlice, createHistorySlice } from './historySlice';
import { type UISlice, createUISlice } from './uiSlice';

export type RootStore = DocumentSlice & UISlice & HistorySlice;

// Aliases retained for backwards compatibility with the original single-file store.
export type DocumentStore = RootStore;

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
