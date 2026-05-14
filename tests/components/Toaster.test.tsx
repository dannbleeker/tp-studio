import { Toaster } from '@/components/toast/Toaster';
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
});
