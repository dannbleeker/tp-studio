import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConfirmDialogHost } from '@/components/ConfirmDialogHost';
import { resetStoreForTest, useDocumentStore } from '@/store';

beforeEach(resetStoreForTest);
afterEach(cleanup);

/**
 * `ConfirmDialogHost` is the app-layer connector between the store's
 * `confirm(): Promise<boolean>` action and the store-free
 * `<ConfirmDialog>` shell. This file owns the store-driven contract:
 *   - Mounts the dialog only when `confirmDialog` is non-null.
 *   - Renders the message + the (optionally custom) labels.
 *   - Confirm resolves the Promise with `true`; Cancel with `false`.
 *   - After resolution, the dialog unmounts.
 */

const openConfirm = (message: string, opts?: { confirmLabel?: string; cancelLabel?: string }) => {
  // Fire-and-forget Promise; tests resolve via clicking buttons.
  void useDocumentStore.getState().confirm(message, opts);
};

describe('ConfirmDialogHost', () => {
  it('renders nothing when no confirm is pending', () => {
    const { container } = render(<ConfirmDialogHost />);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders the message when confirmDialog is open', () => {
    const { container } = render(<ConfirmDialogHost />);
    act(() => openConfirm('Delete forever?'));
    expect(container.textContent).toContain('Delete forever?');
  });

  it('clicking Confirm resolves the Promise with true and closes the dialog', async () => {
    const { container } = render(<ConfirmDialogHost />);
    const promise = useDocumentStore.getState().confirm('Proceed?', { confirmLabel: 'Do it' });
    await new Promise((r) => setTimeout(r, 0));
    const confirmBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Do it'
    );
    expect(confirmBtn).toBeTruthy();
    act(() => fireEvent.click(confirmBtn!));
    const result = await promise;
    expect(result).toBe(true);
    expect(useDocumentStore.getState().confirmDialog).toBeNull();
  });

  it('clicking Cancel resolves the Promise with false', async () => {
    const { container } = render(<ConfirmDialogHost />);
    const promise = useDocumentStore.getState().confirm('Proceed?');
    await new Promise((r) => setTimeout(r, 0));
    const cancelBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Cancel'
    );
    expect(cancelBtn).toBeTruthy();
    act(() => fireEvent.click(cancelBtn!));
    const result = await promise;
    expect(result).toBe(false);
  });

  it('opening a second confirm while one is open resolves the first as false', async () => {
    render(<ConfirmDialogHost />);
    const first = useDocumentStore.getState().confirm('First?');
    const second = useDocumentStore.getState().confirm('Second?');
    // The store's `confirm` action resolves any in-flight prompt with
    // false before opening the new one — first should settle now.
    const firstResult = await first;
    expect(firstResult).toBe(false);
    // The new prompt should be live; resolve it explicitly.
    act(() => useDocumentStore.getState().resolveConfirm(true));
    const secondResult = await second;
    expect(secondResult).toBe(true);
  });
});
