/**
 * CanvasNav — behavioural tests.
 *
 * The component wraps three zoom-action buttons (zoom-out, zoom-in,
 * fit-view), a click-to-edit zoom-percent display, and reads the live
 * viewport zoom via `useZoomLevel` (which delegates to `useStore` from
 * `@xyflow/react`).
 *
 * Strategy
 * --------
 * • Mock `useReactFlow` (via `vi.hoisted` + `vi.mock`) so we can capture
 *   the exact arguments passed to `zoomIn / zoomOut / zoomTo / fitView`.
 * • `useStore` (used by `useZoomLevel`) is left as the *real* implementation
 *   backed by a `ReactFlowProvider`; the provider seeds `transform[2] = 1`
 *   by default so `Math.round(1 * 100) = 100` appears in the chip.
 * • `beforeEach(resetStoreForTest)` resets the Zustand document-store.
 * • `afterEach(cleanup)` unmounts.
 *
 * Covered branches
 * ----------------
 * • Zoom-out button → flow.zoomOut() called.
 * • Zoom-in button → flow.zoomIn() called.
 * • Fit-view button → flow.fitView({ padding: 0.4, maxZoom: 1.2 }) called.
 * • Click percent → enters edit mode (input appears, button disappears).
 * • Edit mode — Enter with valid integer → flow.zoomTo(n/100, { duration: 200 }).
 * • Edit mode — Enter with valid "%" suffix → same zoomTo call.
 * • Edit mode — Enter with invalid text → zoomTo NOT called, exits editing.
 * • Edit mode — Escape → exits editing, zoomTo NOT called.
 * • Edit mode — blur → commits (same as Enter).
 * • Read-only display — zoom percent label reflects current viewport zoom.
 * • stopPropagation inside the input (canvas +/-/0 shortcuts don't fire).
 */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasNav } from '@/components/canvas/overlays/CanvasNav';
import { resetStoreForTest } from '@/store';

// ---------------------------------------------------------------------------
// Mock `useReactFlow` so zoom-action calls are observable.
// The `vi.hoisted` callback runs before any imports, which lets us capture a
// mutable ref that individual tests can inspect via `mockFlow.current.*`.
// ---------------------------------------------------------------------------
const { mockFlowRef } = vi.hoisted(() => ({
  mockFlowRef: {
    current: {
      zoomIn: vi.fn(),
      zoomOut: vi.fn(),
      zoomTo: vi.fn(),
      fitView: vi.fn(),
    },
  },
}));

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  return {
    ...actual,
    useReactFlow: () => mockFlowRef.current,
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wrap in a real ReactFlowProvider so `useStore` (useZoomLevel) resolves. */
const mountNav = (ui: ReactElement = <CanvasNav />) =>
  render(<ReactFlowProvider>{ui}</ReactFlowProvider>);

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetStoreForTest();
  // Reset all mock call counts between tests.
  mockFlowRef.current.zoomIn.mockReset();
  mockFlowRef.current.zoomOut.mockReset();
  mockFlowRef.current.zoomTo.mockReset();
  mockFlowRef.current.fitView.mockReset();
});
afterEach(cleanup);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CanvasNav — mount', () => {
  it('renders without throwing inside a ReactFlowProvider', () => {
    const { container } = mountNav();
    expect(container).toBeTruthy();
  });

  it('renders the zoom percent display at 100% (default viewport zoom = 1)', () => {
    mountNav();
    // The zoom button shows "100%" when viewport zoom is 1.
    expect(screen.getByRole('button', { name: /100%/i })).toBeTruthy();
  });
});

describe('CanvasNav — zoom-out button', () => {
  it('calls flow.zoomOut() when clicked', () => {
    mountNav();
    fireEvent.click(screen.getByRole('button', { name: /zoom out/i }));
    expect(mockFlowRef.current.zoomOut).toHaveBeenCalledOnce();
  });

  it('does not call zoomIn or fitView when zoom-out is clicked', () => {
    mountNav();
    fireEvent.click(screen.getByRole('button', { name: /zoom out/i }));
    expect(mockFlowRef.current.zoomIn).not.toHaveBeenCalled();
    expect(mockFlowRef.current.fitView).not.toHaveBeenCalled();
  });
});

describe('CanvasNav — zoom-in button', () => {
  it('calls flow.zoomIn() when clicked', () => {
    mountNav();
    fireEvent.click(screen.getByRole('button', { name: /zoom in/i }));
    expect(mockFlowRef.current.zoomIn).toHaveBeenCalledOnce();
  });

  it('does not call zoomOut or fitView when zoom-in is clicked', () => {
    mountNav();
    fireEvent.click(screen.getByRole('button', { name: /zoom in/i }));
    expect(mockFlowRef.current.zoomOut).not.toHaveBeenCalled();
    expect(mockFlowRef.current.fitView).not.toHaveBeenCalled();
  });
});

describe('CanvasNav — fit-view button', () => {
  it('calls flow.fitView with { padding: 0.4, maxZoom: 1.2 }', () => {
    mountNav();
    fireEvent.click(screen.getByRole('button', { name: /fit view/i }));
    expect(mockFlowRef.current.fitView).toHaveBeenCalledOnce();
    expect(mockFlowRef.current.fitView).toHaveBeenCalledWith({ padding: 0.4, maxZoom: 1.2 });
  });

  it('does not call zoomIn or zoomOut when fit-view is clicked', () => {
    mountNav();
    fireEvent.click(screen.getByRole('button', { name: /fit view/i }));
    expect(mockFlowRef.current.zoomIn).not.toHaveBeenCalled();
    expect(mockFlowRef.current.zoomOut).not.toHaveBeenCalled();
  });
});

describe('CanvasNav — click-to-edit zoom percent', () => {
  it('clicking the percent button enters edit mode (input appears)', () => {
    mountNav();
    expect(screen.queryByRole('textbox', { name: /set zoom percent/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /100%/i }));
    expect(screen.getByRole('textbox', { name: /set zoom percent/i })).toBeTruthy();
  });

  it('entering edit mode hides the percent button', () => {
    mountNav();
    fireEvent.click(screen.getByRole('button', { name: /100%/i }));
    // The percent display is now an <input>, not a <button>.
    expect(screen.queryByRole('button', { name: /100%/i })).toBeNull();
  });

  it('Enter with a valid integer commits the zoom and exits edit mode', () => {
    mountNav();
    fireEvent.click(screen.getByRole('button', { name: /100%/i }));
    const input = screen.getByRole('textbox', { name: /set zoom percent/i });

    // Set the input value, then fire Enter — the handler reads e.currentTarget.value
    // from the real DOM node, so we must update the value via fireEvent.change first.
    fireEvent.change(input, { target: { value: '150' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // zoomTo is called with 1.5 (= 150/100) and the 200 ms duration.
    expect(mockFlowRef.current.zoomTo).toHaveBeenCalledWith(1.5, { duration: 200 });
    // Input is gone → back to button.
    expect(screen.queryByRole('textbox', { name: /set zoom percent/i })).toBeNull();
  });

  it('Enter with a "%" suffix strips the suffix and zooms correctly', () => {
    mountNav();
    fireEvent.click(screen.getByRole('button', { name: /100%/i }));
    const input = screen.getByRole('textbox', { name: /set zoom percent/i });

    fireEvent.change(input, { target: { value: '75%' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockFlowRef.current.zoomTo).toHaveBeenCalledWith(0.75, { duration: 200 });
  });

  it('Enter with a fractional value (e.g. 87.5) zooms correctly', () => {
    mountNav();
    fireEvent.click(screen.getByRole('button', { name: /100%/i }));
    const input = screen.getByRole('textbox', { name: /set zoom percent/i });

    fireEvent.change(input, { target: { value: '87.5' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockFlowRef.current.zoomTo).toHaveBeenCalledWith(0.875, { duration: 200 });
  });

  it('Escape exits edit mode without calling zoomTo', () => {
    mountNav();
    fireEvent.click(screen.getByRole('button', { name: /100%/i }));
    const input = screen.getByRole('textbox', { name: /set zoom percent/i });

    fireEvent.keyDown(input, { key: 'Escape' });

    expect(mockFlowRef.current.zoomTo).not.toHaveBeenCalled();
    // Back to button.
    expect(screen.queryByRole('textbox', { name: /set zoom percent/i })).toBeNull();
  });

  it('Enter with an invalid (non-numeric) value does NOT call zoomTo and exits edit mode', () => {
    mountNav();
    fireEvent.click(screen.getByRole('button', { name: /100%/i }));
    const input = screen.getByRole('textbox', { name: /set zoom percent/i });

    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockFlowRef.current.zoomTo).not.toHaveBeenCalled();
    // The component still exits edit mode.
    expect(screen.queryByRole('textbox', { name: /set zoom percent/i })).toBeNull();
  });

  it('Enter with zero does NOT call zoomTo (zero is not > 0)', () => {
    mountNav();
    fireEvent.click(screen.getByRole('button', { name: /100%/i }));
    const input = screen.getByRole('textbox', { name: /set zoom percent/i });

    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockFlowRef.current.zoomTo).not.toHaveBeenCalled();
  });

  it('Enter with a negative value does NOT call zoomTo', () => {
    mountNav();
    fireEvent.click(screen.getByRole('button', { name: /100%/i }));
    const input = screen.getByRole('textbox', { name: /set zoom percent/i });

    fireEvent.change(input, { target: { value: '-50' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockFlowRef.current.zoomTo).not.toHaveBeenCalled();
  });

  it('blur commits the value (same as Enter)', () => {
    mountNav();
    fireEvent.click(screen.getByRole('button', { name: /100%/i }));
    const input = screen.getByRole('textbox', { name: /set zoom percent/i });

    // Change the value then blur.
    fireEvent.change(input, { target: { value: '200' } });
    fireEvent.blur(input);

    expect(mockFlowRef.current.zoomTo).toHaveBeenCalledWith(2, { duration: 200 });
  });

  it('keydown events inside the input stop propagation (prevent canvas shortcuts)', () => {
    mountNav();
    fireEvent.click(screen.getByRole('button', { name: /100%/i }));
    const input = screen.getByRole('textbox', { name: /set zoom percent/i });

    // All keydowns inside the input call stopPropagation on the synthetic event.
    // React's synthetic event stopPropagation stops propagation within React's
    // event system (which uses event delegation at the root). Native listeners
    // added ABOVE the React root (e.g. on window) should NOT fire.
    let reached = false;
    const windowListener = (e: Event) => {
      // Only count it if it originated from our input.
      if (e.target === input) reached = true;
    };
    window.addEventListener('keydown', windowListener);

    // Typing "5" inside the input — stopPropagation means window listener
    // for non-Enter/Escape keys does not see this event.
    fireEvent.keyDown(input, { key: '5' });

    window.removeEventListener('keydown', windowListener);
    // The window listener must not have fired because stopPropagation was called.
    expect(reached).toBe(false);
  });
});

describe('CanvasNav — multiple zoom actions in sequence', () => {
  it('can zoom in, zoom out, and fit view in a single mount without interfering', () => {
    mountNav();
    fireEvent.click(screen.getByRole('button', { name: /zoom in/i }));
    fireEvent.click(screen.getByRole('button', { name: /zoom out/i }));
    fireEvent.click(screen.getByRole('button', { name: /fit view/i }));
    expect(mockFlowRef.current.zoomIn).toHaveBeenCalledOnce();
    expect(mockFlowRef.current.zoomOut).toHaveBeenCalledOnce();
    expect(mockFlowRef.current.fitView).toHaveBeenCalledOnce();
  });

  it('editing zoom then pressing fit-view still calls fitView after edit is committed', () => {
    mountNav();
    // Enter edit mode and commit.
    fireEvent.click(screen.getByRole('button', { name: /100%/i }));
    const input = screen.getByRole('textbox', { name: /set zoom percent/i });
    fireEvent.change(input, { target: { value: '120' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockFlowRef.current.zoomTo).toHaveBeenCalledWith(1.2, { duration: 200 });

    // After commit the chip is back to a button — fit-view should still work.
    fireEvent.click(screen.getByRole('button', { name: /fit view/i }));
    expect(mockFlowRef.current.fitView).toHaveBeenCalledOnce();
  });

  it('entering and escaping edit mode multiple times stays stable', () => {
    mountNav();
    for (let i = 0; i < 3; i++) {
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: /100%/i }));
      });
      const input = screen.getByRole('textbox', { name: /set zoom percent/i });
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(screen.queryByRole('textbox')).toBeNull();
    }
    expect(mockFlowRef.current.zoomTo).not.toHaveBeenCalled();
  });
});
