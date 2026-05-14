import { StatusStrip } from '@/components/canvas/StatusStrip';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

beforeEach(resetStoreForTest);
afterEach(cleanup);

/**
 * Session 87 (S24) — global status strip. Renders one chip per
 * active secondary mode (lock / hoist / history / wizard / search /
 * compare). The strip renders nothing when no secondary state is
 * active; each chip dismisses its corresponding mode when clicked.
 */
describe('StatusStrip', () => {
  it('renders nothing when no secondary mode is active', () => {
    const { container } = render(<StatusStrip />);
    expect(container.querySelector('[data-component="status-strip"]')).toBeNull();
  });

  it('renders a "Browse Lock" chip when the doc is locked', () => {
    act(() => useDocumentStore.getState().setBrowseLocked(true));
    const { container, getByText } = render(<StatusStrip />);
    expect(container.querySelector('[data-component="status-strip"]')).toBeTruthy();
    expect(getByText('Browse Lock')).toBeTruthy();
  });

  it('clicking the lock chip unlocks the document', () => {
    act(() => useDocumentStore.getState().setBrowseLocked(true));
    const { container } = render(<StatusStrip />);
    const chip = container.querySelector(
      'button[aria-label="Exit Browse Lock"]'
    ) as HTMLButtonElement;
    expect(chip).toBeTruthy();
    act(() => fireEvent.click(chip));
    expect(useDocumentStore.getState().browseLocked).toBe(false);
  });

  it('renders multiple chips when multiple secondary modes are active', () => {
    act(() => {
      useDocumentStore.getState().setBrowseLocked(true);
      useDocumentStore.getState().openHistoryPanel();
      useDocumentStore.getState().openSearch();
    });
    const { container } = render(<StatusStrip />);
    expect(container.querySelectorAll('button').length).toBeGreaterThanOrEqual(3);
    expect(container.textContent).toMatch(/Browse Lock/);
    expect(container.textContent).toMatch(/History/);
    expect(container.textContent).toMatch(/Search/);
  });
});
