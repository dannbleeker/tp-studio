import { resetStoreForTest, useDocumentStore } from '@/store';
import { beforeEach, describe, expect, it } from 'vitest';

beforeEach(resetStoreForTest);

/**
 * Session 88 (V2) — combined EC chrome collapse flag.
 *
 * The two existing strips (reading-instructions + verbalisation) used
 * to live as independent dismiss / collapse controls on the canvas.
 * Wrapping them in a single collapsible container with one chevron
 * adds an outer flag (`ecChromeCollapsed`).
 *
 * Session 89 EC chrome cleanup flipped the default to `true` (hidden)
 * — the outer "EC CHROME" label row was eating canvas space on every
 * first load. Users opt into the reading guide via the palette
 * command "Toggle EC reading guide."
 */

describe('Session 88 — ecChromeCollapsed', () => {
  it('defaults to true (chrome hidden) per Session 89 cleanup', () => {
    expect(useDocumentStore.getState().ecChromeCollapsed).toBe(true);
  });

  it('setECChromeCollapsed(false) shows the chrome', () => {
    useDocumentStore.getState().setECChromeCollapsed(false);
    expect(useDocumentStore.getState().ecChromeCollapsed).toBe(false);
  });

  it('flips back to hidden with another call', () => {
    useDocumentStore.getState().setECChromeCollapsed(false);
    useDocumentStore.getState().setECChromeCollapsed(true);
    expect(useDocumentStore.getState().ecChromeCollapsed).toBe(true);
  });

  it('resets to true (hidden) on resetStoreForTest', () => {
    useDocumentStore.getState().setECChromeCollapsed(false);
    resetStoreForTest();
    expect(useDocumentStore.getState().ecChromeCollapsed).toBe(true);
  });
});
