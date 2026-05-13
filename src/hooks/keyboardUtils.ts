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
