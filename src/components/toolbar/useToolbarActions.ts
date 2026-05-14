import { LAYOUT_STRATEGY } from '@/domain/layoutStrategy';
import { useDocumentStore } from '@/store';
import { useShallow } from 'zustand/shallow';

/**
 * Shared store subscription bundle for the TopBar cluster — `TopBar` itself
 * plus the `<sm`-only `KebabMenu` that mirrors most of its actions. Both
 * surfaces previously redeclared the same six `useDocumentStore(s => …)`
 * selectors, which meant the store registered twelve subscriptions for
 * what is, conceptually, one toolbar.
 *
 * `useShallow` re-selects only when one of the listed primitives actually
 * changes — flipping the theme doesn't re-render either consumer when the
 * resulting object's keys all `===` the previous tick's values.
 *
 * `showLayoutToggle` is derived from `LAYOUT_STRATEGY[diagramType]` so the
 * two consumers can't drift on the rule for hiding the radial toggle
 * (currently EC, whose hand-positioned geometry IS the diagnostic).
 */
export type ToolbarActions = {
  // State.
  theme: ReturnType<typeof useDocumentStore.getState>['theme'];
  layoutMode: ReturnType<typeof useDocumentStore.getState>['layoutMode'];
  historyPanelOpen: boolean;
  showLayoutToggle: boolean;
  /** Session 87 (S26) — Undo/Redo affordances on the toolbar. The
   *  flags drive `disabled` state on the buttons; pre-fix Cmd+Z
   *  worked but had no visible control surface. */
  canUndo: boolean;
  canRedo: boolean;
  // Actions.
  toggleTheme: () => void;
  openHelp: () => void;
  toggleHistoryPanel: () => void;
  setLayoutMode: (mode: 'flow' | 'radial') => void;
  undo: () => void;
  redo: () => void;
};

export const useToolbarActions = (): ToolbarActions =>
  useDocumentStore(
    useShallow((s) => ({
      theme: s.theme,
      layoutMode: s.layoutMode,
      historyPanelOpen: s.historyPanelOpen,
      showLayoutToggle: LAYOUT_STRATEGY[s.doc.diagramType] === 'auto',
      canUndo: s.past.length > 0,
      canRedo: s.future.length > 0,
      toggleTheme: s.toggleTheme,
      openHelp: s.openHelp,
      toggleHistoryPanel: s.toggleHistoryPanel,
      setLayoutMode: s.setLayoutMode,
      undo: s.undo,
      redo: s.redo,
    }))
  );
