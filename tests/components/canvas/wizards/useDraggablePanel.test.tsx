/**
 * Session coverage push — `useDraggablePanel` was at 28% lines.
 *
 * Branch coverage targets
 * -----------------------
 * • pointerdown on handle → starts drag, captures pointer, sets dragPos
 * • pointerdown with button !== 0 → no drag started
 * • pointerdown on inner <button> → no drag started (closest('button') guard)
 * • pointermove while dragging → position updates (clamped)
 * • pointermove when NOT dragging → no-op
 * • pointerup while dragging → calls onCommit, clears drag, releases capture
 * • pointerup when NOT dragging → no-op
 * • pointercancel → discards drag without calling onCommit
 * • viewport clamping: x < (minVisible - w), x > vw - minVisible, y < 0, y > vh - minVisible
 * • committed (non-null) → positioned reflects committed when not dragging
 * • committed null → positioned is null when not dragging
 * • live drag overrides committed
 * • panelRef null → pointerdown is a no-op
 */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDraggablePanel } from '@/components/canvas/wizards/useDraggablePanel';

// ---------------------------------------------------------------------------
// Viewport dimensions used throughout
// ---------------------------------------------------------------------------
const VW = 1280;
const VH = 800;

beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: VW });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: VH });
});

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal mock DOMRect for the panel element. */
const makeRect = (left: number, top: number, width = 300, height = 400): DOMRect =>
  ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  }) as DOMRect;

/**
 * Build a minimal React.PointerEvent-like object suitable for the handlers.
 * Returns the event plus the vi.fn() stubs for `setPointerCapture` and
 * `releasePointerCapture` so callers can assert on them.
 *
 * `target` defaults to a real DOM <div> so that `.closest('button')` works
 * (the hook calls `e.target.closest('button')` to guard inner button clicks).
 */
const makePointerEvent = (
  overrides: Partial<{
    button: number;
    clientX: number;
    clientY: number;
    pointerId: number;
    target: HTMLElement;
  }> = {}
): {
  event: React.PointerEvent<HTMLDivElement>;
  setPointerCapture: ReturnType<typeof vi.fn>;
  releasePointerCapture: ReturnType<typeof vi.fn>;
} => {
  const setPointerCapture = vi.fn();
  const releasePointerCapture = vi.fn();
  // Use a real DOM element so the full Element prototype chain (including
  // closest()) is available if the hook calls methods on currentTarget.
  const ctEl = document.createElement('div');
  ctEl.setPointerCapture = setPointerCapture as unknown as typeof ctEl.setPointerCapture;
  ctEl.releasePointerCapture =
    releasePointerCapture as unknown as typeof ctEl.releasePointerCapture;
  // target defaults to a plain <div> (not inside a <button>) so
  // closest('button') returns null and the drag-start guard passes.
  const target: HTMLElement = overrides.target ?? document.createElement('div');
  const event = {
    button: 0,
    clientX: 0,
    clientY: 0,
    pointerId: 1,
    ...overrides,
    target,
    currentTarget: ctEl,
  } as unknown as React.PointerEvent<HTMLDivElement>;
  return { event, setPointerCapture, releasePointerCapture };
};

/**
 * Render the hook wired to a panel element whose getBoundingClientRect
 * returns `rect`. Returns { result, rerender, onCommit, panelEl }.
 */
const setup = (opts: { committed?: { x: number; y: number } | null; rect?: DOMRect } = {}) => {
  const onCommit = vi.fn();
  const committed = opts.committed ?? null;
  const rect = opts.rect ?? makeRect(100, 150);

  const { result, rerender } = renderHook(
    ({ c }: { c: typeof committed }) => useDraggablePanel({ committed: c, onCommit }),
    { initialProps: { c: committed } }
  );

  // Wire a real (mocked) panel div whose getBoundingClientRect drives the math.
  const panelEl = document.createElement('div');
  panelEl.getBoundingClientRect = vi.fn(() => rect);

  // Attach the ref imperatively.
  act(() => {
    (result.current.panelRef as React.MutableRefObject<HTMLDivElement>).current = panelEl;
  });

  return { result, rerender, onCommit, panelEl };
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useDraggablePanel — initial / committed state', () => {
  it('positioned is null when committed is null and no drag is active', () => {
    const { result } = setup({ committed: null });
    expect(result.current.positioned).toBeNull();
  });

  it('positioned reflects committed when not dragging', () => {
    const { result } = setup({ committed: { x: 200, y: 300 } });
    expect(result.current.positioned).toEqual({ left: 200, top: 300 });
  });

  it('updates positioned when committed prop changes', () => {
    const { result, rerender } = setup({ committed: null });
    expect(result.current.positioned).toBeNull();

    rerender({ c: { x: 50, y: 80 } });
    expect(result.current.positioned).toEqual({ left: 50, top: 80 });
  });
});

describe('useDraggablePanel — pointerdown guard: non-primary button', () => {
  it('does NOT start a drag for button !== 0', () => {
    const { result } = setup();
    const { event, setPointerCapture } = makePointerEvent({
      button: 2,
      clientX: 120,
      clientY: 170,
    });

    act(() => {
      result.current.dragHandlers.onPointerDown(event);
    });

    // No drag started → positioned still null (no committed either).
    expect(result.current.positioned).toBeNull();
    // setPointerCapture should NOT be called.
    expect(setPointerCapture).not.toHaveBeenCalled();
  });
});

describe('useDraggablePanel — pointerdown guard: inner button', () => {
  it('does NOT start a drag when the event target is an inner <button>', () => {
    const { result, panelEl } = setup();

    // Create a real <button> *inside* the panel div and append it to the DOM
    // so that `button.closest('button')` returns the button itself.
    const button = document.createElement('button');
    panelEl.appendChild(button);

    const { event, setPointerCapture } = makePointerEvent({
      button: 0,
      clientX: 120,
      clientY: 170,
      target: button, // pointer landed on the inner button
    });

    act(() => {
      result.current.dragHandlers.onPointerDown(event);
    });

    expect(result.current.positioned).toBeNull();
    expect(setPointerCapture).not.toHaveBeenCalled();
  });
});

describe('useDraggablePanel — full drag lifecycle', () => {
  it('pointerdown starts a drag: positioned updates to panel origin and captures pointer', () => {
    const rect = makeRect(100, 150, 300, 400);
    const { result } = setup({ rect });

    const { event, setPointerCapture } = makePointerEvent({
      button: 0,
      clientX: 150,
      clientY: 200,
    });

    act(() => {
      result.current.dragHandlers.onPointerDown(event);
    });

    // After pointerdown, dragPos = { x: rect.left, y: rect.top }
    expect(result.current.positioned).toEqual({ left: 100, top: 150 });
    // setPointerCapture must be called exactly once.
    expect(setPointerCapture).toHaveBeenCalledTimes(1);
  });

  it('pointermove updates position: (clientX - dx, clientY - dy) clamped', () => {
    // Panel at (100, 150), width=300 — pointer grabbed at (150,200) so dx=50, dy=50.
    const rect = makeRect(100, 150, 300, 400);
    const { result } = setup({ rect });

    // Start drag at (150, 200)
    const { event: down } = makePointerEvent({ button: 0, clientX: 150, clientY: 200 });
    act(() => {
      result.current.dragHandlers.onPointerDown(down);
    });

    // Move to (300, 250) → raw new pos: (300-50, 250-50) = (250, 200)
    // Clamp bounds: x in [40-300 .. 1280-40] = [-260 .. 1240], y in [0 .. 760]
    // 250 and 200 are in-range → no clamping.
    const { event: move } = makePointerEvent({ clientX: 300, clientY: 250 });
    act(() => {
      result.current.dragHandlers.onPointerMove(move);
    });

    expect(result.current.positioned).toEqual({ left: 250, top: 200 });
  });

  it('live drag position overrides a non-null committed value', () => {
    const rect = makeRect(100, 150, 300, 400);
    const { result } = setup({ committed: { x: 999, y: 999 }, rect });

    const { event: down } = makePointerEvent({ button: 0, clientX: 150, clientY: 200 });
    act(() => {
      result.current.dragHandlers.onPointerDown(down);
    });

    // Positioned should be the LIVE drag position, not committed.
    expect(result.current.positioned).toEqual({ left: 100, top: 150 });
  });

  it('pointerup calls onCommit with final position, clears drag, releases pointer capture', () => {
    const rect = makeRect(100, 150, 300, 400);
    const { result, onCommit } = setup({ rect });

    const { event: down } = makePointerEvent({ button: 0, clientX: 150, clientY: 200 });
    act(() => {
      result.current.dragHandlers.onPointerDown(down);
    });

    // Move to a new location: dx=50, dy=50 → raw (250, 200)
    const { event: move } = makePointerEvent({ clientX: 300, clientY: 250 });
    act(() => {
      result.current.dragHandlers.onPointerMove(move);
    });

    const { event: up, releasePointerCapture } = makePointerEvent({ pointerId: 1 });
    act(() => {
      result.current.dragHandlers.onPointerUp(up);
    });

    // onCommit called with the last live position.
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(250, 200);

    // drag ends → positioned falls back to committed (null → null here).
    expect(result.current.positioned).toBeNull();

    // releasePointerCapture must be called.
    expect(releasePointerCapture).toHaveBeenCalledTimes(1);
  });

  it('pointermove after pointerup is a no-op (drag ref cleared)', () => {
    const rect = makeRect(100, 150, 300, 400);
    const { result, onCommit } = setup({ rect });

    const { event: down } = makePointerEvent({ button: 0, clientX: 150, clientY: 200 });
    act(() => {
      result.current.dragHandlers.onPointerDown(down);
    });

    const { event: up } = makePointerEvent({ pointerId: 1 });
    act(() => {
      result.current.dragHandlers.onPointerUp(up);
    });

    // Move AFTER drag ended — should be ignored.
    const { event: lateMove } = makePointerEvent({ clientX: 800, clientY: 600 });
    act(() => {
      result.current.dragHandlers.onPointerMove(lateMove);
    });

    // onCommit still called exactly once (from the pointerup).
    expect(onCommit).toHaveBeenCalledTimes(1);
    // positioned still null (no active drag, no committed).
    expect(result.current.positioned).toBeNull();
  });
});

describe('useDraggablePanel — pointercancel', () => {
  it('discards the drag without calling onCommit', () => {
    const rect = makeRect(100, 150, 300, 400);
    const { result, onCommit } = setup({ rect });

    const { event: down } = makePointerEvent({ button: 0, clientX: 150, clientY: 200 });
    act(() => {
      result.current.dragHandlers.onPointerDown(down);
    });

    // Confirm drag is active.
    expect(result.current.positioned).toEqual({ left: 100, top: 150 });

    // Trigger cancel.
    const { event: cancel } = makePointerEvent();
    act(() => {
      result.current.dragHandlers.onPointerCancel(cancel);
    });

    // onCommit must NOT have been called.
    expect(onCommit).not.toHaveBeenCalled();
    // Drag is discarded → positioned is null.
    expect(result.current.positioned).toBeNull();
  });

  it('pointercancel while not dragging is a no-op', () => {
    const { result, onCommit } = setup();

    const { event: cancel } = makePointerEvent();
    act(() => {
      result.current.dragHandlers.onPointerCancel(cancel);
    });

    expect(onCommit).not.toHaveBeenCalled();
    expect(result.current.positioned).toBeNull();
  });
});

describe('useDraggablePanel — pointerup with no active drag', () => {
  it('does nothing when pointerup fires without a preceding pointerdown', () => {
    const { result, onCommit } = setup();

    const { event: up, releasePointerCapture } = makePointerEvent({ pointerId: 1 });
    act(() => {
      result.current.dragHandlers.onPointerUp(up);
    });

    expect(onCommit).not.toHaveBeenCalled();
    // releasePointerCapture must NOT be called.
    expect(releasePointerCapture).not.toHaveBeenCalled();
  });
});

describe('useDraggablePanel — viewport clamping', () => {
  it('clamps x to minVisible - panelWidth when moving too far left', () => {
    // panel width=300, minVisible=40 → min cx = 40 - 300 = -260
    const rect = makeRect(0, 0, 300, 400);
    const { result } = setup({ rect });

    // dx = 10 - 0 = 10, dy = 10 - 0 = 10
    const { event: down } = makePointerEvent({ button: 0, clientX: 10, clientY: 10 });
    act(() => {
      result.current.dragHandlers.onPointerDown(down);
    });

    // Move way left: clientX = -500 → raw x = -500 - 10 = -510 → clamped to -260
    const { event: move } = makePointerEvent({ clientX: -500, clientY: 50 });
    act(() => {
      result.current.dragHandlers.onPointerMove(move);
    });

    expect(result.current.positioned?.left).toBe(40 - 300); // -260
  });

  it('clamps x to vw - minVisible when moving too far right', () => {
    // vw=1280, minVisible=40 → max cx = 1240
    const rect = makeRect(0, 0, 300, 400);
    const { result } = setup({ rect });

    const { event: down } = makePointerEvent({ button: 0, clientX: 10, clientY: 10 });
    act(() => {
      result.current.dragHandlers.onPointerDown(down);
    });

    // Move way right: clientX = 9999 → raw x = 9999 - 10 = 9989 → clamped to 1240
    const { event: move } = makePointerEvent({ clientX: 9999, clientY: 50 });
    act(() => {
      result.current.dragHandlers.onPointerMove(move);
    });

    expect(result.current.positioned?.left).toBe(VW - 40); // 1240
  });

  it('clamps y to 0 when moving above the top edge', () => {
    // Panel top=10, pointer grabbed at clientY=20 → dy = 20 - 10 = 10
    const rect = makeRect(100, 10, 300, 400);
    const { result } = setup({ rect });

    const { event: down } = makePointerEvent({ button: 0, clientX: 150, clientY: 20 });
    act(() => {
      result.current.dragHandlers.onPointerDown(down);
    });

    // Move above viewport: clientY = -9999 → raw y = -9999 - 10 = -10009 → clamped to 0
    const { event: move } = makePointerEvent({ clientX: 200, clientY: -9999 });
    act(() => {
      result.current.dragHandlers.onPointerMove(move);
    });

    expect(result.current.positioned?.top).toBe(0);
  });

  it('clamps y to vh - minVisible when moving below the bottom edge', () => {
    // vh=800, minVisible=40 → max cy = 760
    const rect = makeRect(100, 0, 300, 400);
    const { result } = setup({ rect });

    // dy = 10 - 0 = 10
    const { event: down } = makePointerEvent({ button: 0, clientX: 150, clientY: 10 });
    act(() => {
      result.current.dragHandlers.onPointerDown(down);
    });

    // Move below: clientY = 9999 → raw y = 9999 - 10 = 9989 → clamped to 760
    const { event: move } = makePointerEvent({ clientX: 200, clientY: 9999 });
    act(() => {
      result.current.dragHandlers.onPointerMove(move);
    });

    expect(result.current.positioned?.top).toBe(VH - 40); // 760
  });

  it('commits the clamped x position on pointerup', () => {
    // Move far right so x is clamped; onCommit should receive the clamped value.
    const rect = makeRect(0, 0, 300, 400);
    const { result, onCommit } = setup({ rect });

    const { event: down } = makePointerEvent({ button: 0, clientX: 10, clientY: 10 });
    act(() => {
      result.current.dragHandlers.onPointerDown(down);
    });

    const { event: move } = makePointerEvent({ clientX: 9999, clientY: 50 });
    act(() => {
      result.current.dragHandlers.onPointerMove(move);
    });

    const { event: up } = makePointerEvent({ pointerId: 1 });
    act(() => {
      result.current.dragHandlers.onPointerUp(up);
    });

    // Committed x must be the clamped value (VW - 40 = 1240).
    expect(onCommit).toHaveBeenCalledWith(VW - 40, expect.any(Number));
  });
});

describe('useDraggablePanel — panelRef not mounted', () => {
  it('does NOT start a drag when panelRef.current is null', () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() => useDraggablePanel({ committed: null, onCommit }));
    // panelRef.current is null (never attached) — hook should return early.
    const { event, setPointerCapture } = makePointerEvent({
      button: 0,
      clientX: 100,
      clientY: 100,
    });
    act(() => {
      result.current.dragHandlers.onPointerDown(event);
    });

    expect(result.current.positioned).toBeNull();
    expect(setPointerCapture).not.toHaveBeenCalled();
  });
});
