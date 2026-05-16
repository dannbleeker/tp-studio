/**
 * Session 97 — Placement math tests for the SelectionToolbar.
 *
 * The component invokes `computeToolbarPlacement` to figure out
 * where to render itself; this file pins the three concerns that
 * function handles:
 *   1. Default-above anchoring with horizontal centering.
 *   2. Flip-below when the bbox sits near the viewport top.
 *   3. Horizontal clamp so the centroid doesn't fall off-screen.
 *
 * Inputs are simple records; no DOM, no React. The component-level
 * tests in `tests/components/SelectionToolbar.test.tsx` cover the
 * end-to-end "click → toolbar appears" path against the mocked
 * rect; this file pins the geometry independently.
 */
import { computeToolbarPlacement } from '@/components/canvas/selectionToolbarPlacement';
import { describe, expect, it } from 'vitest';

const DEFAULTS = {
  viewport: { width: 1024, height: 768 },
  estimatedHeight: 36,
  estimatedWidth: 320,
  gap: 10,
  viewportMargin: 8,
};

describe('computeToolbarPlacement', () => {
  it('anchors above the selection by default and centers horizontally', () => {
    const result = computeToolbarPlacement({
      ...DEFAULTS,
      selectionRect: { left: 400, top: 300, right: 600, bottom: 400 },
    });
    // Center of selection = 500. Toolbar's centroid clamped to that.
    expect(result.left).toBe(500);
    // Top = selectionTop - height - gap = 300 - 36 - 10 = 254.
    expect(result.top).toBe(254);
    expect(result.flipped).toBe(false);
  });

  it('flips below when the would-be top clips out the viewport', () => {
    const result = computeToolbarPlacement({
      ...DEFAULTS,
      // Selection right at the top — would-be top = 20 - 36 - 10 = -26.
      selectionRect: { left: 400, top: 20, right: 600, bottom: 80 },
    });
    expect(result.flipped).toBe(true);
    // Flipped top = selectionBottom + gap = 80 + 10 = 90.
    expect(result.top).toBe(90);
  });

  it('clamps the centroid left when the selection is at the viewport edge', () => {
    const result = computeToolbarPlacement({
      ...DEFAULTS,
      // Selection at the left edge — center = 50. Half-width
      // (160) + margin (8) = 168 minimum centroid. 50 < 168 so
      // clamps to 168.
      selectionRect: { left: 0, top: 200, right: 100, bottom: 280 },
    });
    expect(result.left).toBe(168);
  });

  it('clamps the centroid right when the selection is at the right edge', () => {
    const result = computeToolbarPlacement({
      ...DEFAULTS,
      // Selection at right edge — center = 970. Half-width (160)
      // + margin (8) means max-centroid = 1024 - 168 = 856. 970 >
      // 856 so clamps to 856.
      selectionRect: { left: 920, top: 200, right: 1020, bottom: 280 },
    });
    expect(result.left).toBe(856);
  });

  it('centers on viewport when too narrow for the toolbar to fit on either side', () => {
    const result = computeToolbarPlacement({
      ...DEFAULTS,
      viewport: { width: 200, height: 768 },
      selectionRect: { left: 0, top: 200, right: 50, bottom: 280 },
    });
    // 200 < estimatedWidth (320) — clamp is impossible; falls
    // back to viewport center (200/2 = 100).
    expect(result.left).toBe(100);
  });

  it('honors a custom gap', () => {
    const result = computeToolbarPlacement({
      ...DEFAULTS,
      gap: 24,
      selectionRect: { left: 400, top: 300, right: 600, bottom: 400 },
    });
    // 300 - 36 - 24 = 240.
    expect(result.top).toBe(240);
  });
});
