import { useSyncExternalStore } from 'react';

/**
 * Subscribe to the browser's network-reachability flag.
 *
 * Built on `useSyncExternalStore` (same idiom as `useMediaQuery`) rather than
 * `useState` + `useEffect`: the flag can flip between render and commit, and
 * the store form is tear-free under concurrent rendering — with a `useEffect`
 * seed the first paint would always claim "online" and then correct itself,
 * which is exactly the wrong direction for a reassurance signal.
 *
 * `navigator.onLine` is deliberately trusted as-is. It is a *lower* bound on
 * connectivity (a captive portal still reports `true`), but the only thing
 * this drives is an informational chip, and the false direction that matters —
 * claiming offline while online — cannot happen.
 *
 * Guarded for non-DOM contexts so importing the hook into a plain unit test or
 * a future SSR/prerender pass does not throw.
 */

const subscribe = (onChange: () => void): (() => void) => {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
};

// Anything that is not an explicit `false` counts as online, so a browser (or
// a jsdom build) without `navigator.onLine` never shows a phantom offline chip.
const getSnapshot = (): boolean => typeof navigator === 'undefined' || navigator.onLine !== false;

const getServerSnapshot = (): boolean => true;

/** True while the browser believes it has a network connection. */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
