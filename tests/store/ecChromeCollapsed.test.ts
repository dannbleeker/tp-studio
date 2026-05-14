import { resetStoreForTest, useDocumentStore } from '@/store';
import { beforeEach, describe, expect, it } from 'vitest';

beforeEach(resetStoreForTest);

/**
 * Session 88 (V2) — combined EC chrome collapse flag.
 *
 * The two existing strips (reading-instructions + verbalisation) used
 * to live as independent dismiss / collapse controls on the canvas.
 * Wrapping them in a single collapsible container with one chevron
 * adds an outer flag (`ecChromeCollapsed`). The per-strip flags stay
 * available — this layer is the *outer* control.
 */

describe('Session 88 — ecChromeCollapsed', () => {
  it('defaults to false (expanded surface)', () => {
    expect(useDocumentStore.getState().ecChromeCollapsed).toBe(false);
  });

  it('setECChromeCollapsed(true) collapses the surface', () => {
    useDocumentStore.getState().setECChromeCollapsed(true);
    expect(useDocumentStore.getState().ecChromeCollapsed).toBe(true);
  });

  it('flips back to expanded with another call', () => {
    useDocumentStore.getState().setECChromeCollapsed(true);
    useDocumentStore.getState().setECChromeCollapsed(false);
    expect(useDocumentStore.getState().ecChromeCollapsed).toBe(false);
  });

  it('resets to false on resetStoreForTest', () => {
    useDocumentStore.getState().setECChromeCollapsed(true);
    resetStoreForTest();
    expect(useDocumentStore.getState().ecChromeCollapsed).toBe(false);
  });
});
