import { useSyncExternalStore } from 'react';

/**
 * Subscribe to a CSS media query from React. Returns whether the query
 * currently matches, and re-renders when that flips.
 *
 * Built on `useSyncExternalStore` so it's tear-free under concurrent
 * rendering and SSR-safe (server snapshot is always `false` — the app is a
 * client-only PWA, but the guard keeps the hook honest if it's ever imported
 * into a non-DOM context / test without `matchMedia`).
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = (onChange: () => void): (() => void) => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return () => {};
    }
    const mql = window.matchMedia(query);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  };
  const getSnapshot = (): boolean =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(query).matches;
  // Server / no-DOM: report "not matching" so components render their
  // default (desktop / fine-pointer) branch.
  const getServerSnapshot = (): boolean => false;
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// Tailwind's `sm` breakpoint is 640px; "phone" is everything below it. Kept in
// sync with the `sm:`-prefixed responsive rules in the chrome (BlocksRail,
// CanvasNav, TabStrip) so the JS gate and the CSS gate flip at the same width.
const PHONE_QUERY = '(max-width: 639.98px)';

/** True on phone-narrow viewports (below Tailwind's `sm`). */
export function useIsPhoneViewport(): boolean {
  return useMediaQuery(PHONE_QUERY);
}

/**
 * True when the primary pointer is coarse (finger / stylus) rather than a
 * mouse. Drives touch-first canvas behaviour — one-finger pan instead of a
 * marquee, larger connection-handle hit areas.
 */
export function useIsCoarsePointer(): boolean {
  return useMediaQuery('(pointer: coarse)');
}
