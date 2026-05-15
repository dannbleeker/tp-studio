/**
 * Session 94 (Top-30 #16) — auto-focus the first focusable child when a
 * surface becomes active.
 *
 * Three places in the codebase had a near-identical pattern:
 *   1. ContextMenu — focuses first menuitem on open.
 *   2. KebabMenu — focuses first **enabled** menuitem on open (skips
 *      the disabled Undo/Redo when no history).
 *   3. ConfirmDialog — focuses the primary CTA so Enter activates it.
 *
 * They all walk `containerRef.current.querySelectorAll('selector')`,
 * find the first matching element with `!disabled`, and call `.focus()`.
 * This hook standardises the pattern with the disabled-skip baked in
 * so a future "first focusable" surface inherits the right behaviour
 * automatically.
 *
 * @example
 *   useAutoFocusFirstEnabled(menuRef, open, '[role="menuitem"]');
 *
 * Why `enabled` is a deps trigger rather than the listener guard:
 *   the hook re-runs whenever `enabled` flips OR `selector` changes,
 *   so dynamic content (e.g. Undo/Redo disabling itself as history
 *   advances) auto-refocuses correctly. Pair with `containerRef.current?.focus()`
 *   in a cleanup if a parent wants the trigger restored on close.
 */
import { type RefObject, useEffect } from 'react';

export function useAutoFocusFirstEnabled(
  containerRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  selector: string
): void {
  useEffect(() => {
    if (!enabled) return;
    const nodes = containerRef.current?.querySelectorAll<HTMLElement>(selector);
    if (!nodes) return;
    const firstEnabled = Array.from(nodes).find(
      (el) => !(el as HTMLButtonElement | HTMLInputElement).disabled
    );
    firstEnabled?.focus();
  }, [enabled, selector, containerRef]);
}
