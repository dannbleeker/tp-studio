import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LargeDialog } from '@/components/ui/LargeDialog';

/**
 * Session 135 (design audit #19) — LargeDialog opens as a true modal
 * via `showModal()` (with a jsdom / old-browser `el.open = true`
 * fallback). These tests pin: it mounts content without throwing on
 * `showModal()`, the X button + Esc both fire `onClose`, and it
 * unmounts cleanly when `open` flips false.
 */

afterEach(cleanup);

describe('LargeDialog', () => {
  it('renders the title + children when open (no showModal throw)', () => {
    const { getByText } = render(
      <LargeDialog open onClose={() => {}} title="My picker">
        <p>Body content</p>
      </LargeDialog>
    );
    expect(getByText('My picker')).toBeTruthy();
    expect(getByText('Body content')).toBeTruthy();
  });

  it('leaves the native <dialog> open (showModal or the fallback)', () => {
    const { container } = render(
      <LargeDialog open onClose={() => {}} title="Open state">
        <p>x</p>
      </LargeDialog>
    );
    const dialog = container.querySelector('dialog');
    expect(dialog).toBeTruthy();
    // Either `showModal()` (modal) or the `el.open = true` fallback
    // leaves the element open after the mount effect runs.
    expect((dialog as HTMLDialogElement).open).toBe(true);
  });

  it('renders nothing when open is false', () => {
    const { container } = render(
      <LargeDialog open={false} onClose={() => {}} title="Closed">
        <p>x</p>
      </LargeDialog>
    );
    expect(container.querySelector('dialog')).toBeNull();
  });

  it('fires onClose from the close button', () => {
    const onClose = vi.fn();
    const { getByLabelText } = render(
      <LargeDialog open onClose={onClose} title="Closable">
        <p>x</p>
      </LargeDialog>
    );
    fireEvent.click(getByLabelText('Close Closable'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('fires onClose on Escape', () => {
    const onClose = vi.fn();
    render(
      <LargeDialog open onClose={onClose} title="Esc-able">
        <p>x</p>
      </LargeDialog>
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
