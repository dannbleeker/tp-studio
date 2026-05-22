import type { StateCreator } from 'zustand';
import type { RootStore } from '../types';
import { type ConfirmSlice, confirmDefaults, createConfirmSlice } from './confirmSlice';
import { createDialogsSlice, type DialogsSlice, dialogsDefaults } from './dialogsSlice';
import {
  createPreferencesSlice,
  type PreferencesSlice,
  preferencesDefaults,
} from './preferencesSlice';
import { createSearchSlice, type SearchSlice, searchDefaults } from './searchSlice';
import { createSelectionSlice, type SelectionSlice, selectionDefaults } from './selectionSlice';
import {
  createSpeculationSlice,
  type SpeculationSlice,
  speculationDefaults,
} from './speculationSlice';
import { createToastsSlice, type ToastsSlice, toastsDefaults } from './toastsSlice';
import {
  createWalkthroughSlice,
  type WalkthroughSlice,
  walkthroughDefaults,
} from './walkthroughSlice';

// Re-export types so external consumers (Inspector, Settings, etc.) can
// keep importing from `@/store/uiSlice` after the split — the path
// resolves to this index file.
export type {
  AnimationSpeed,
  AppMode,
  CausalityLabel,
  ContextMenuState,
  ContextMenuTarget,
  DefaultLayoutDirection,
  EdgePalette,
  LayoutMode,
  SearchOptions,
  Selection,
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
  WalkthroughSlice &
  SpeculationSlice &
  ToastsSlice &
  ConfirmSlice;

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
  | keyof ReturnType<typeof speculationDefaults>
  | keyof ReturnType<typeof toastsDefaults>
  | keyof ReturnType<typeof confirmDefaults>
> => ({
  ...selectionDefaults(),
  ...preferencesDefaults(),
  ...dialogsDefaults(),
  ...searchDefaults(),
  ...walkthroughDefaults(),
  ...speculationDefaults(),
  ...toastsDefaults(),
  ...confirmDefaults(),
});

export const createUISlice: StateCreator<RootStore, [], [], UISlice> = (...args) => ({
  ...createSelectionSlice(...args),
  ...createPreferencesSlice(...args),
  ...createDialogsSlice(...args),
  ...createSearchSlice(...args),
  ...createWalkthroughSlice(...args),
  ...createSpeculationSlice(...args),
  ...createToastsSlice(...args),
  ...createConfirmSlice(...args),
});
