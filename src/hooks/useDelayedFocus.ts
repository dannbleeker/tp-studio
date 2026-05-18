import { type RefObject, useEffect } from 'react';

/**
 * Session 130 — focus a ref after an optional delay when `active` flips
 * true. Consolidates the `useEffect` + `setTimeout` + `clearTimeout`
 * pattern that lived in three dialog mount paths
 * (CommandPalette, QuickCaptureDialog, SearchPanel).
 *
 * Why the delay matters:
 *   - 0 ms — flush the focus on the next macrotask so React's commit
 *     completes first. CommandPalette uses this so the new `<input>`
 *     is already in the DOM when `.focus()` fires.
 *   - 50–60 ms — sync with a slide-in animation. SearchPanel uses
 *     60 ms; QuickCapture uses 50 ms. Focusing too early on a slide-in
 *     panel can break the animation's "feel" because focus styles
 *     paint mid-transition.
 *
 * The hook does NOT cooperate with `useFocusTrap` — both can run on
 * the same element; the trap moves focus to the first focusable on
 * mount, then this hook (via setTimeout) moves it to the specific
 * ref. The macrotask ordering means the explicit focus always wins
 * the visible-focus race.
 *
 * `delayMs` defaults to 0; pass an explicit value when the focus
 * needs to sync with a transition.
 */
export const useDelayedFocus = (
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  delayMs = 0
): void => {
  useEffect(() => {
    if (!active) return;
    const id = window.setTimeout(() => ref.current?.focus(), delayMs);
    return () => window.clearTimeout(id);
  }, [active, delayMs, ref]);
};
