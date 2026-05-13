import { useGlobalShortcuts } from './useGlobalShortcuts';
import { useSelectionShortcuts } from './useSelectionShortcuts';

/**
 * Composes the two context-keyed keyboard hooks into the single entry point
 * `App.tsx` mounts. Splitting the original ~370-line monolith made each half
 * testable in isolation and matches the registry's natural partition:
 *
 *   - {@link useGlobalShortcuts} — selection-agnostic keys (palette, save,
 *     export, settings, find, quick capture, clipboard, undo / redo, Esc
 *     cascade, +/-/0 zoom).
 *   - {@link useSelectionShortcuts} — keys whose meaning depends on what's
 *     selected (Enter, Tab, Delete, Arrow nav, Cmd+Shift+Arrow expansion,
 *     group expand / collapse).
 *
 * Both register their own `keydown` listener on `window`. The branches inside
 * each hook are mutually exclusive on `(key, modifiers, selection state)` so
 * running two handlers per event is safe — only one will match any given
 * keystroke and call `preventDefault`.
 */
export function useGlobalKeyboard() {
  useGlobalShortcuts();
  useSelectionShortcuts();
}
