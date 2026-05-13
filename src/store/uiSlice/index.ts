import type { StateCreator } from 'zustand';
import type { RootStore } from '../types';
import { type DialogsSlice, createDialogsSlice, dialogsDefaults } from './dialogsSlice';
import {
  type PreferencesSlice,
  createPreferencesSlice,
  preferencesDefaults,
} from './preferencesSlice';
import { type SearchSlice, createSearchSlice, searchDefaults } from './searchSlice';
import { type SelectionSlice, createSelectionSlice, selectionDefaults } from './selectionSlice';
import {
  type WalkthroughSlice,
  createWalkthroughSlice,
  walkthroughDefaults,
} from './walkthroughSlice';

// Re-export types so external consumers (Inspector, Settings, etc.) can
// keep importing from `@/store/uiSlice` after the split — the path
// resolves to this index file.
export type {
  AnimationSpeed,
  CausalityLabel,
  ContextMenuState,
  ContextMenuTarget,
  DefaultLayoutDirection,
  EdgePalette,
  LayoutMode,
  Selection,
  SearchOptions,
  StoredPrefs,
  Theme,
  Toast,
  ToastKind,
} from './types';

/**
 * UI slice as the consumer-facing union of four sub-slices. Each sub-slice
 * owns a cohesive concern:
 *
 *   - `SelectionSlice` — selection / editing / hoist
 *   - `PreferencesSlice` — theme + persisted UI prefs + dismissable tips
 *   - `DialogsSlice` — palette / help / settings / docSettings / contextMenu
 *     / toasts / quickCapture
 *   - `SearchSlice` — in-document search state
 *
 * The four are concatenated into a single object at slice-creation time,
 * so component-level consumers see a flat surface (e.g.
 * `useDocumentStore((s) => s.searchOpen)`) and don't need to know about
 * the internal sub-slice boundaries.
 */
export type UISlice = SelectionSlice &
  PreferencesSlice &
  DialogsSlice &
  SearchSlice &
  WalkthroughSlice;

/**
 * Data-only defaults for the unified slice. Used by `resetStoreForTest` to
 * snap every UI field back to a deterministic starting point regardless
 * of whatever localStorage values were read at slice init.
 */
export const uiDefaults = (): Pick<
  UISlice,
  | keyof ReturnType<typeof selectionDefaults>
  | keyof ReturnType<typeof preferencesDefaults>
  | keyof ReturnType<typeof dialogsDefaults>
  | keyof ReturnType<typeof searchDefaults>
  | keyof ReturnType<typeof walkthroughDefaults>
> => ({
  ...selectionDefaults(),
  ...preferencesDefaults(),
  ...dialogsDefaults(),
  ...searchDefaults(),
  ...walkthroughDefaults(),
});

export const createUISlice: StateCreator<RootStore, [], [], UISlice> = (...args) => ({
  ...createSelectionSlice(...args),
  ...createPreferencesSlice(...args),
  ...createDialogsSlice(...args),
  ...createSearchSlice(...args),
  ...createWalkthroughSlice(...args),
});
