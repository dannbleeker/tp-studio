import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

afterEach(cleanup);

/**
 * `ConfirmDialog` is the store-free, prop-driven shell. This file is its
 * component-level contract:
 *   - Renders nothing when `open` is false.
 *   - Renders the message (children) + the (optionally custom) labels.
 *   - Confirm button fires `onConfirm`; Cancel fires `onCancel`.
 *
 * The store-driven open/close + Promise flow lives on the app-layer
 * host — see `ConfirmDialogHost.test.tsx` and
 * `tests/services/confirmations.test.ts`.
 */

describe('ConfirmDialog (pure shell)', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <ConfirmDialog open={false} onConfirm={() => {}} onCancel={() => {}}>
        Delete forever?
      </ConfirmDialog>
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders the message when open', () => {
    const { container } = render(
      <ConfirmDialog open onConfirm={() => {}} onCancel={() => {}}>
        Delete forever?
      </ConfirmDialog>
    );
    expect(container.textContent).toContain('Delete forever?');
  });

  it('renders custom button labels', () => {
    const { container } = render(
      <ConfirmDialog
        open
        confirmLabel="Do it"
        cancelLabel="Back"
        onConfirm={() => {}}
        onCancel={() => {}}
      >
        Proceed?
      </ConfirmDialog>
    );
    const labels = Array.from(container.querySelectorAll('button')).map((b) => b.textContent);
    expect(labels).toContain('Do it');
    expect(labels).toContain('Back');
  });

  it('clicking Confirm fires onConfirm', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { container } = render(
      <ConfirmDialog open confirmLabel="Do it" onConfirm={onConfirm} onCancel={onCancel}>
        Proceed?
      </ConfirmDialog>
    );
    const btn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Do it'
    );
    fireEvent.click(btn!);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('clicking Cancel fires onCancel', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { container } = render(
      <ConfirmDialog open onConfirm={onConfirm} onCancel={onCancel}>
        Proceed?
      </ConfirmDialog>
    );
    const btn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Cancel'
    );
    fireEvent.click(btn!);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
