import { type RefObject, useEffect } from 'react';

/**
 * While `active` is true, calls `onDismiss` when the user:
 *   - presses Escape, or
 *   - clicks anywhere outside the element referenced by `containerRef`.
 *
 * Useful for popovers, context menus, and dialogs that should dismiss on
 * outside interaction without each component reimplementing the listener
 * + cleanup boilerplate.
 */
export function useOutsideAndEscape(
  containerRef: RefObject<HTMLElement | null>,
  onDismiss: () => void,
  active: boolean
): void {
  useEffect(() => {
    if (!active) return undefined;

    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };

    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [active, containerRef, onDismiss]);
}
