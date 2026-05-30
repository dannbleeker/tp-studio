/**
 * PWA install / display-mode detection.
 *
 * `isStandalonePWA()` is true only when the app runs as an INSTALLED PWA
 * (launched from the home screen / app icon — `display-mode: standalone`
 * and friends) rather than inside a normal browser tab.
 *
 * The tab-management keyboard shortcuts (Cmd/Ctrl+T / +W / +1–9) gate on
 * this: browsers reserve those keys for their own tab strip and won't let a
 * page override them, so binding them in a normal tab would be a no-op that
 * also fights the browser. In a standalone window there is no browser tab
 * strip, so the app owns them. In a normal tab the portable path is the
 * command palette (New / Close / Next / Previous tab).
 */
export function isStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false;
  // iOS Safari home-screen apps expose a non-standard `navigator.standalone`.
  if ((window.navigator as { standalone?: boolean }).standalone === true) return true;
  if (typeof window.matchMedia !== 'function') return false;
  // Any installed display mode counts — `standalone` is the common one; the
  // others cover minimal-ui, fullscreen, and desktop window-controls-overlay.
  return window.matchMedia(
    '(display-mode: standalone), (display-mode: minimal-ui), (display-mode: fullscreen), (display-mode: window-controls-overlay)'
  ).matches;
}
