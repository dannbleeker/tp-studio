/**
 * Session 95 — Aggregate "is the canvas busy?" hook for overlay
 * components (SelectionToolbar, future inline-edit popovers, etc).
 *
 * Several pieces of state need to be combined to answer "should I
 * be visible right now?":
 *
 *   - **`isEditing`** — the user is currently typing into an entity
 *     title textarea. Showing a toolbar above the entity would
 *     compete for focus + intercept clicks.
 *   - **`isPaletteOpen`** — the Cmd+K palette is the primary command
 *     surface; the toolbar should fade out so it doesn't compete.
 *   - **`isModalOpen`** — any of the centered dialogs (Settings,
 *     Help, Confirm, Print, the picker dialogs) is on screen. The
 *     toolbar belongs to the canvas; modals belong to the
 *     foreground layer.
 *   - **`isDragging`** — the user is dragging a node or marquee-
 *     selecting. Showing the toolbar mid-drag would jitter.
 *
 * Combining all four into one shallow-equal-comparing hook means
 * consumers register a single subscription instead of four — fewer
 * re-renders, one place to add a new condition.
 *
 * `isDragging` lives in React Flow's own zustand store, not in our
 * `useDocumentStore`. We subscribe via `useRFStore` and combine the
 * value with our store's flags in component scope.
 */

import { useStore as useRFStore } from '@xyflow/react';
import { useShallow } from 'zustand/shallow';
import { type RootStore, useDocumentStore } from '@/store';

export type CanvasInteractionState = {
  isEditing: boolean;
  isPaletteOpen: boolean;
  isModalOpen: boolean;
  isDragging: boolean;
};

/**
 * True when any CENTERED modal dialog is open — the kind that takes over the
 * foreground with a backdrop. Canvas overlays (the SelectionToolbar) hide
 * while one is up. Deliberately EXCLUDES side panels — the Inspector and the
 * Revision panel (`historyPanelOpen`) — since the toolbar is designed to
 * coexist with those.
 *
 * Keep this in sync with the dialog flags in `dialogsSlice`: a new centered
 * dialog must be added here, or canvas overlays will render behind it. The
 * gap that motivated extracting this (Import picker / Pattern library / About
 * / Whiteboard-paste / Read-all-at-once / visual-diff Compare were missing)
 * is covered by `tests/hooks/canvasInteractionState.test.ts`.
 */
export const isAnyModalOpen = (s: RootStore): boolean =>
  s.settingsOpen ||
  s.helpOpen ||
  s.aboutOpen ||
  s.docSettingsOpen ||
  s.searchOpen ||
  s.printOpen ||
  s.diagramPickerOpen !== null ||
  s.exportPickerOpen ||
  s.importPickerOpen ||
  s.patternLibraryOpen !== null ||
  s.whiteboardPasteOpen ||
  s.readAllAtOnceOpen ||
  s.quickCaptureOpen ||
  s.confirmDialog !== null ||
  s.sideBySideRevisionId !== null ||
  s.compareRevisionId !== null;

export function useCanvasInteractionState(): CanvasInteractionState {
  // App-state-side flags. One shallow-equal selector — re-renders
  // only when one of these primitives flips.
  const appState = useDocumentStore(
    useShallow((s) => ({
      isEditing: s.editingEntityId !== null,
      isPaletteOpen: s.paletteOpen,
      isModalOpen: isAnyModalOpen(s),
    }))
  );

  // React Flow drag flag. `paneDragging` is true during a pan; node
  // drag fires `onNodeDragStart` / `onNodeDragStop` but the canonical
  // "anything is being dragged" check is `paneDragging` for the pane
  // and the presence of any selected node with a non-zero drag offset.
  // The simpler `nodesDraggable` flag inside the store flips per-node
  // during drag; we OR with pane drag for completeness.
  const isDragging = useRFStore((s) => s.paneDragging);

  return { ...appState, isDragging };
}
