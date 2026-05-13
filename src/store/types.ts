// Leaf module for the combined store type. Lives here so individual slice
// files can `import type` it without creating a runtime cycle through
// `index.ts` (which has runtime imports from each slice).

import type { DocumentSlice } from './documentSlice';
import type { HistorySlice } from './historySlice';
import type { RevisionsSlice } from './revisionsSlice';
import type { UISlice } from './uiSlice';

export type RootStore = DocumentSlice & UISlice & HistorySlice & RevisionsSlice;

// Alias retained for backwards compatibility with the original single-file store.
export type DocumentStore = RootStore;
