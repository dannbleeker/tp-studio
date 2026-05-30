/**
 * `isStandalonePWA()` — the gate for the installed-app tab shortcuts.
 *
 * The regression that matters: `(display-mode: fullscreen)` must NOT count,
 * because that media query also matches the browser's own F11 fullscreen in
 * a normal (non-installed) tab — which would falsely enable Cmd+1–9 tab
 * switching there. The app's manifest is `display: standalone`, so a real
 * install only ever reports standalone / minimal-ui / window-controls-overlay.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { isStandalonePWA } from '@/services/pwa';

// jsdom has no matchMedia; stub it as a predicate over the query string.
const stubMatchMedia = (matchIf: (q: string) => boolean) =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: matchIf(q), media: q }));

afterEach(() => vi.unstubAllGlobals());

describe('isStandalonePWA', () => {
  it('is true for an installed standalone PWA', () => {
    stubMatchMedia((q) => q.includes('standalone'));
    expect(isStandalonePWA()).toBe(true);
  });

  it('is FALSE in browser F11 fullscreen (display-mode: fullscreen must not count)', () => {
    // Simulate a normal browser tab in F11 fullscreen: only the `fullscreen`
    // media feature matches. The gate must not fire — the query the helper
    // builds no longer mentions `fullscreen`, so this resolves to no-match.
    stubMatchMedia((q) => q.includes('fullscreen'));
    expect(isStandalonePWA()).toBe(false);
  });

  it('is true for an installed minimal-ui / window-controls-overlay PWA', () => {
    stubMatchMedia((q) => q.includes('minimal-ui') || q.includes('window-controls-overlay'));
    expect(isStandalonePWA()).toBe(true);
  });

  it('is false in a normal browser tab (no display-mode matches)', () => {
    stubMatchMedia(() => false);
    expect(isStandalonePWA()).toBe(false);
  });
});
