import { Toaster } from '@/components/toast/Toaster';
import { TOAST_AUTO_DISMISS_MS_BY_KIND } from '@/domain/constants';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Session 83 — fills the parked Toaster test gap.
 *
 * Verifies what unit tests of the store action alone can't catch: the
 * Toaster component actually renders queued toasts, dedups identical
 * ones, dismisses on user click, and auto-dismisses after the
 * configured timeout via the `setTimeout` in `showToast`.
 */

describe('Toaster', () => {
  beforeEach(() => {
    resetStoreForTest();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders nothing when the queue is empty', () => {
    const { container } = render(<Toaster />);
    expect(container.firstChild).toBeNull();
  });

  it('renders an info toast with its message', () => {
    useDocumentStore.getState().showToast('info', 'Saved');
    render(<Toaster />);
    expect(screen.getByText('Saved')).toBeTruthy();
  });

  it('renders one DOM node per queued toast', () => {
    const { showToast } = useDocumentStore.getState();
    showToast('info', 'A');
    showToast('success', 'B');
    showToast('error', 'C');
    render(<Toaster />);
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.getByText('B')).toBeTruthy();
    expect(screen.getByText('C')).toBeTruthy();
  });

  it('dedups identical (kind, message) toasts', () => {
    const { showToast } = useDocumentStore.getState();
    showToast('info', 'duplicate me');
    showToast('info', 'duplicate me');
    showToast('info', 'duplicate me');
    expect(useDocumentStore.getState().toasts).toHaveLength(1);
    render(<Toaster />);
    // Only one rendered.
    expect(screen.getAllByText('duplicate me')).toHaveLength(1);
  });

  it('dismisses a toast when the Dismiss button is clicked', () => {
    useDocumentStore.getState().showToast('info', 'click to clear');
    render(<Toaster />);
    expect(screen.getByText('click to clear')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Dismiss'));
    expect(useDocumentStore.getState().toasts).toHaveLength(0);
  });

  it('auto-dismisses after the configured timeout', () => {
    vi.useFakeTimers();
    useDocumentStore.getState().showToast('info', 'goodbye');
    expect(useDocumentStore.getState().toasts).toHaveLength(1);
    // Advance well past the auto-dismiss timeout (~6s in production).
    vi.advanceTimersByTime(60_000);
    expect(useDocumentStore.getState().toasts).toHaveLength(0);
  });

  // Session 88 (S14) — toasts can carry an optional action button.
  it('renders the action button when the toast carries one', () => {
    useDocumentStore
      .getState()
      .showToast('success', 'Loaded template: X', { action: { label: 'Undo', run: () => {} } });
    render(<Toaster />);
    expect(screen.getByText('Undo')).toBeTruthy();
  });

  it('clicking the action button invokes run + dismisses the toast', () => {
    const onUndo = vi.fn();
    useDocumentStore
      .getState()
      .showToast('success', 'Loaded template: X', { action: { label: 'Undo', run: onUndo } });
    render(<Toaster />);
    fireEvent.click(screen.getByText('Undo'));
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(useDocumentStore.getState().toasts).toHaveLength(0);
  });

  // Session 91 — per-kind auto-dismiss defaults.
  // We pin behavior at three specific points along the timeline:
  //   1. Just before the success default: success is still queued.
  //   2. After the success default but before the info default: success
  //      has dismissed itself, info is still queued.
  //   3. After the error default: error has dismissed itself.
  // This catches any regression that collapses the three kinds back to
  // a single timeout without enumerating exact ms values in the
  // assertions (we read them from the constants module).
  it('auto-dismiss timeout grades by kind (success short, info medium, error long)', () => {
    vi.useFakeTimers();
    const { showToast } = useDocumentStore.getState();
    showToast('success', 's');
    showToast('info', 'i');
    showToast('error', 'e');
    expect(useDocumentStore.getState().toasts).toHaveLength(3);

    // Just before success expires — all three still queued.
    vi.advanceTimersByTime(TOAST_AUTO_DISMISS_MS_BY_KIND.success - 1);
    expect(useDocumentStore.getState().toasts).toHaveLength(3);

    // Cross success's threshold — success drops off, info + error survive.
    vi.advanceTimersByTime(2);
    let queued = useDocumentStore.getState().toasts;
    expect(queued.map((t) => t.message)).toEqual(['i', 'e']);

    // Cross info's threshold — only error survives.
    vi.advanceTimersByTime(
      TOAST_AUTO_DISMISS_MS_BY_KIND.info - TOAST_AUTO_DISMISS_MS_BY_KIND.success
    );
    queued = useDocumentStore.getState().toasts;
    expect(queued.map((t) => t.message)).toEqual(['e']);

    // Cross error's threshold — queue empty.
    vi.advanceTimersByTime(
      TOAST_AUTO_DISMISS_MS_BY_KIND.error - TOAST_AUTO_DISMISS_MS_BY_KIND.info
    );
    expect(useDocumentStore.getState().toasts).toHaveLength(0);
  });

  it('honors a per-call `durationMs` override above the per-kind default', () => {
    vi.useFakeTimers();
    // 15 s on an info toast — used by the PWA "New version available"
    // toast so the user has time to save canvas state before refreshing.
    useDocumentStore.getState().showToast('info', 'persist longer', { durationMs: 15_000 });
    // The default info dismiss would have fired by now; the override
    // keeps the toast on the queue.
    vi.advanceTimersByTime(TOAST_AUTO_DISMISS_MS_BY_KIND.info + 100);
    expect(useDocumentStore.getState().toasts).toHaveLength(1);
    // Cross the override threshold — gone.
    vi.advanceTimersByTime(15_000);
    expect(useDocumentStore.getState().toasts).toHaveLength(0);
  });

  it('renders a prominent (filled) action button when `action.prominent` is set', () => {
    useDocumentStore.getState().showToast('info', 'New version available.', {
      action: { label: 'Refresh now', run: () => {}, prominent: true },
    });
    render(<Toaster />);
    const btn = screen.getByText('Refresh now') as HTMLButtonElement;
    // Filled CTA = indigo background. The exact class string is brittle
    // to pin literally; assert the filled-color signal instead so a
    // future Tailwind tweak (e.g. switching to violet) still passes as
    // long as the button is no longer a transparent outline.
    expect(btn.className).toMatch(/bg-indigo-/);
  });
});
