import { guardWriteOrToast } from '@/services/browseLock';
import { getCanvasInstance } from '@/services/canvasRef';
import { copySelection, cutSelection, pasteClipboard } from '@/services/clipboard';
import { flushPersist } from '@/services/persistDebounced';
import { useDocumentStore } from '@/store';
import { useEffect } from 'react';
import { useShallow } from 'zustand/shallow';
import { isEditableTarget } from './keyboardUtils';

/**
 * Selection-agnostic global keyboard shortcuts. Everything that does not
 * depend on what the user has selected lives here — palette open, save,
 * settings, find, quick capture, clipboard, undo/redo, the Esc cascade,
 * and the +/-/0 zoom keys. Shortcuts that ONLY make sense while
 * something is selected (Enter, Tab, Arrow nav, Delete, the Cmd+Shift+
 * Arrow successor/predecessor expansion) live in
 * `useSelectionShortcuts`.
 *
 * Each branch carries a `// reg: <id>` marker that the registry-link
 * test (`tests/hooks/shortcutRegistry.test.ts`) cross-checks against
 * `SHORTCUTS` in `@/domain/shortcuts`. Adding a new branch here without
 * the marker fails CI.
 */
export function useGlobalShortcuts() {
  // One shallow-equal selector for all the actions we bind. Zustand actions
  // are stable references, so this effectively runs once and stops re-rendering
  // this hook on every store mutation.
  const { togglePalette, closePalette, closeHelp, undo, redo, clearSelection, showToast } =
    useDocumentStore(
      useShallow((s) => ({
        togglePalette: s.togglePalette,
        closePalette: s.closePalette,
        closeHelp: s.closeHelp,
        undo: s.undo,
        redo: s.redo,
        clearSelection: s.clearSelection,
        showToast: s.showToast,
      }))
    );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const cmdOrCtrl = e.metaKey || e.ctrlKey;
      const inField = isEditableTarget(e.target);

      // reg: palette
      // Cmd/Ctrl+K — palette (works anywhere)
      if (cmdOrCtrl && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        togglePalette();
        return;
      }

      // reg: save / swap-entities
      // Cmd/Ctrl+S — flush any debounced write synchronously, then toast.
      // Cmd/Ctrl+Shift+S — swap two selected entities (mnemonic from PRD).
      if (cmdOrCtrl && e.key.toLowerCase() === 's') {
        if (e.shiftKey) {
          if (inField) return;
          e.preventDefault();
          if (!guardWriteOrToast()) return;
          const state = useDocumentStore.getState();
          const sel = state.selection;
          if (sel.kind === 'entities' && sel.ids.length === 2 && sel.ids[0] && sel.ids[1]) {
            state.swapEntities(sel.ids[0], sel.ids[1]);
            showToast('success', 'Swapped entities.');
          } else {
            showToast('info', 'Select exactly two entities to swap.');
          }
          return;
        }
        e.preventDefault();
        flushPersist();
        showToast('success', 'Saved to this browser.');
        return;
      }

      // reg: export-menu
      // Cmd/Ctrl+E — open the palette pre-filtered to Export commands.
      if (cmdOrCtrl && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        useDocumentStore.getState().openPaletteWithQuery('Export');
        return;
      }

      // reg: settings
      // Cmd/Ctrl+, — open Settings dialog.
      if (cmdOrCtrl && e.key === ',') {
        e.preventDefault();
        useDocumentStore.getState().openSettings();
        return;
      }

      // reg: find
      // Cmd/Ctrl+F — open / focus the Find panel.
      if (cmdOrCtrl && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        useDocumentStore.getState().openSearch();
        return;
      }

      // reg: toggle-inspector
      // Cmd/Ctrl+\ — close the inspector (brief §9). Inspector is
      // selection-driven; this shortcut clears the selection, which
      // slides the panel off-screen. Reopening it means clicking an
      // entity or edge again. No-op when nothing is selected — the
      // ergonomic loss (vs. a forced-show flag) is small.
      if (cmdOrCtrl && e.key === '\\') {
        e.preventDefault();
        clearSelection();
        return;
      }

      // reg: quick-capture
      // E (bare) — Quick Capture (FL-QC1). Skip when typing or modifier'd.
      if (!cmdOrCtrl && !e.shiftKey && !e.altKey && !inField && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        if (!guardWriteOrToast()) return;
        useDocumentStore.getState().openQuickCapture();
        return;
      }

      // reg: zoom
      // Zoom shortcuts (FL-DI1). Only fire outside text fields so the OS
      // browser zoom (Cmd+- / Cmd+=) still works while typing.
      const inst = getCanvasInstance();
      if (!inField && cmdOrCtrl === false && inst) {
        if (e.key === '+' || e.key === '=') {
          e.preventDefault();
          inst.zoomIn();
          return;
        }
        if (e.key === '-' || e.key === '_') {
          e.preventDefault();
          inst.zoomOut();
          return;
        }
        if (e.key === '0') {
          e.preventDefault();
          inst.fitView({ padding: 0.4, maxZoom: 1.2, duration: 200 });
          return;
        }
      }

      // reg: copy-cut-paste
      // Cut / Copy / Paste — entity multi-selection within-document clipboard.
      if (cmdOrCtrl && !inField && e.key.toLowerCase() === 'c') {
        const n = copySelection();
        if (n > 0) {
          e.preventDefault();
          showToast('info', `Copied ${n} entit${n === 1 ? 'y' : 'ies'}.`);
        }
        return;
      }
      if (cmdOrCtrl && !inField && e.key.toLowerCase() === 'x') {
        if (!guardWriteOrToast()) return;
        const n = cutSelection();
        if (n > 0) {
          e.preventDefault();
          showToast('info', `Cut ${n} entit${n === 1 ? 'y' : 'ies'}.`);
        }
        return;
      }
      if (cmdOrCtrl && !inField && e.key.toLowerCase() === 'v') {
        if (!guardWriteOrToast()) return;
        const result = pasteClipboard();
        if (result.ok) {
          e.preventDefault();
          showToast('success', `Pasted ${result.entities} entities, ${result.edges} edges.`);
        }
        return;
      }

      // reg: escape
      // Escape — close settings / help / palette / deselect. Cascades through
      // dismissable UI state in z-index-priority order so each press peels
      // back one layer.
      if (e.key === 'Escape') {
        const state = useDocumentStore.getState();
        if (state.quickCaptureOpen) {
          state.closeQuickCapture();
          return;
        }
        if (state.docSettingsOpen) {
          state.closeDocSettings();
          return;
        }
        if (state.settingsOpen) {
          state.closeSettings();
          return;
        }
        if (state.searchOpen) {
          state.closeSearch();
          return;
        }
        if (state.helpOpen) {
          closeHelp();
          return;
        }
        if (state.paletteOpen) {
          closePalette();
          return;
        }
        if (state.historyPanelOpen) {
          state.closeHistoryPanel();
          return;
        }
        if (state.editingEntityId !== null) {
          // node textarea will handle its own escape; let it bubble
          return;
        }
        // Hoist takes precedence over deselect, so Esc rises out of nested
        // groups one level at a time.
        if (state.hoistedGroupId !== null) {
          state.unhoist();
          return;
        }
        clearSelection();
        return;
      }

      // reg: undo / redo
      // Cmd/Ctrl+Z — undo / Cmd/Ctrl+Shift+Z — redo (skip when typing)
      if (cmdOrCtrl && e.key.toLowerCase() === 'z') {
        if (inField) return;
        e.preventDefault();
        if (!guardWriteOrToast()) return;
        if (e.shiftKey) redo();
        else undo();
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePalette, closePalette, closeHelp, undo, redo, clearSelection, showToast]);
}
