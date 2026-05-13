import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

beforeEach(resetStoreForTest);
afterEach(cleanup);

/**
 * `ConfirmDialog` renders the in-app replacement for `window.confirm`.
 * The store-level Promise flow is covered by `tests/services/confirmations.test.ts`;
 * this file is the component-level contract:
 *   - Mounts only when `confirmDialog` is non-null.
 *   - Renders the message + the (optionally custom) button labels.
 *   - Confirm button resolves with `true`; Cancel resolves with `false`.
 *   - After resolution, the dialog unmounts.
 *
 * The auto-focus + Enter-activates-Confirm behaviors live in
 * `confirmations.test.ts` (where the full call path runs); jsdom's
 * focus behavior under `display: none` ancestors is unreliable, so
 * those assertions stay in the integration test layer.
 */

const openConfirm = (message: string, opts?: { confirmLabel?: string; cancelLabel?: string }) => {
  // Fire-and-forget Promise; tests resolve via clicking buttons.
  void useDocumentStore.getState().confirm(message, opts);
};

describe('ConfirmDialog', () => {
  it('renders nothing when no confirm is pending', () => {
    const { container } = render(<ConfirmDialog />);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders the message when confirmDialog is open', () => {
    const { container } = render(<ConfirmDialog />);
    act(() => openConfirm('Delete forever?'));
    expect(container.textContent).toContain('Delete forever?');
  });

  it('clicking Confirm resolves the Promise with true and closes the dialog', async () => {
    const { container } = render(<ConfirmDialog />);
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
    const { container } = render(<ConfirmDialog />);
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
    render(<ConfirmDialog />);
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
