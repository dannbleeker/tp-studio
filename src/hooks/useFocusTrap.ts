import { type RefObject, useEffect } from 'react';

/**
 * Session 79 / brief §10 + accessibility audit — focus trap hook.
 *
 * When `active` is true, keyboard focus is trapped inside the given
 * container ref:
 *
 *   - Tab past the last focusable element wraps to the first.
 *   - Shift+Tab past the first focusable element wraps to the last.
 *   - Initial mount focuses the first focusable element inside the
 *     container (or the container itself if it carries `tabIndex`).
 *
 * Used by modal dialogs that should keep focus inside their bounds
 * until dismissed. Mirrors the WAI-ARIA Authoring Practices "dialog
 * (modal)" pattern; intentionally simple — no Tab-cycle CSS hacks.
 *
 * The hook does NOT handle Escape — wire that up at the call site if
 * you want it (most consumers do via a separate onKeyDown handler).
 */
export const useFocusTrap = (
  containerRef: RefObject<HTMLElement | null>,
  active: boolean
): void => {
  useEffect(() => {
    if (!active) return;
    const root = containerRef.current;
    if (!root) return;
    // Save the previously-focused element so we can restore on close.
    const previouslyFocused = (document.activeElement as HTMLElement | null) ?? null;
    // Selector covers the standard list of focusable elements.
    const focusables = (): HTMLElement[] => {
      const nodes = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      return Array.from(nodes).filter(
        (n) => n.offsetParent !== null || n === document.activeElement
      );
    };

    // Move focus to the first focusable element so screen-readers
    // announce the dialog content rather than whatever was focused
    // before.
    const first = focusables()[0];
    if (first) first.focus();
    else root.focus();

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (list.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = list[0]!;
      const lastEl = list[list.length - 1]!;
      const current = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (current === firstEl || !root.contains(current)) {
          e.preventDefault();
          lastEl.focus();
        }
      } else if (current === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    root.addEventListener('keydown', onKeyDown);
    return () => {
      root.removeEventListener('keydown', onKeyDown);
      // Restore focus to the element that had it before the dialog
      // opened. Helps keyboard users return to the trigger.
      if (previouslyFocused && document.body.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [active, containerRef]);
};
