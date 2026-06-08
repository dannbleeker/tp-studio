/**
 * Shared keyboard-handling utilities. Lifted out of `useGlobalKeyboard` when
 * that hook was split into context-keyed sub-hooks (`useGlobalShortcuts` +
 * `useSelectionShortcuts`); both still need to ignore keystrokes that
 * originate inside an editable widget so the user can type normally in a
 * textarea / input / contenteditable without firing global commands.
 */

/**
 * True when the keyboard event originated inside a focusable text input.
 * Used by every selection-sensitive shortcut to bail out so that typing
 * inside the inspector's title textarea (or any other editable field)
 * doesn't accidentally trigger global commands.
 */
export const isEditableTarget = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
};

/**
 * True when the keyboard event originated on (or inside) an actionable control
 * — a button, link, select, or ARIA button / menu item — rather than the canvas
 * pane (`role="application"`), a canvas node (`role="group"`), or the document
 * body. The bare-key canvas-selection shortcuts (Delete, Tab, Enter, A, Arrows)
 * bail on these so a keystroke meant for a focused toolbar / inspector /
 * context-menu control isn't ALSO interpreted as a canvas command (e.g. Tab on a
 * focused button must move focus, not mint a child entity; Backspace must not
 * delete the selection). Text inputs are handled separately by `isEditableTarget`
 * — the two are OR-ed at the call site. `closest` catches a focusable child (a
 * `<span>` inside a button); non-element targets like `window` return false.
 *
 * Deliberately scoped to `useSelectionShortcuts` (canvas bare keys). It does NOT
 * gate the app-wide CHORDS in `useGlobalShortcuts` (undo / redo / save), which
 * should still work while a button has focus.
 */
export const isInteractiveTarget = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null;
  if (!el || typeof el.closest !== 'function') return false;
  return el.closest('button, a[href], select, [role="button"], [role="menuitem"]') !== null;
};
