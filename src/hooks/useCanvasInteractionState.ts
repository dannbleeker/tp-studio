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
import { useDocumentStore } from '@/store';
import { useStore as useRFStore } from '@xyflow/react';
import { useShallow } from 'zustand/shallow';

export type CanvasInteractionState = {
  isEditing: boolean;
  isPaletteOpen: boolean;
  isModalOpen: boolean;
  isDragging: boolean;
};

export function useCanvasInteractionState(): CanvasInteractionState {
  // App-state-side flags. One shallow-equal selector — re-renders
  // only when one of these primitives flips.
  const appState = useDocumentStore(
    useShallow((s) => ({
      isEditing: s.editingEntityId !== null,
      isPaletteOpen: s.paletteOpen,
      isModalOpen:
        s.settingsOpen ||
        s.helpOpen ||
        s.docSettingsOpen ||
        s.searchOpen ||
        s.printOpen ||
        s.diagramPickerOpen !== null ||
        s.exportPickerOpen ||
        s.templatePickerOpen ||
        s.confirmDialog !== null ||
        s.quickCaptureOpen ||
        s.sideBySideRevisionId !== null,
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
