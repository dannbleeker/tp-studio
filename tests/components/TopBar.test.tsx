import { TopBar } from '@/components/toolbar/TopBar';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

beforeEach(resetStoreForTest);
afterEach(cleanup);

/**
 * TopBar drives the upper-right toolbar cluster:
 *   - Commands (palette toggle)
 *   - Browse-lock toggle
 *   - F5 layout-mode toggle (hidden when the current diagram is manual-layout)
 *   - Help button
 *   - Theme toggle
 *
 * Each test resets the store, mounts the bar, fires a click, then asserts on
 * the resulting store state. We query buttons by `aria-label` because the
 * narrow-viewport icon-only variants don't have visible text — the labels are
 * the contract the rest of the app (and screen readers) rely on.
 */

const click = (el: Element): void => {
  act(() => fireEvent.click(el));
};

describe('TopBar', () => {
  it('Commands button toggles the palette open', () => {
    const { container } = render(<TopBar />);
    // Two Commands buttons exist (mobile icon + desktop wide); both wire to
    // togglePalette, so we click the first and check the store state.
    const cmd = container.querySelector('button[aria-label="Commands"]');
    expect(cmd).toBeTruthy();
    expect(useDocumentStore.getState().paletteOpen).toBe(false);
    click(cmd!);
    expect(useDocumentStore.getState().paletteOpen).toBe(true);
  });

  it('Lock button flips browseLocked and updates aria-pressed', () => {
    const { container } = render(<TopBar />);
    const lockBtn = container.querySelector(
      'button[aria-label="Lock document for browsing"]'
    ) as HTMLButtonElement;
    expect(lockBtn).toBeTruthy();
    expect(lockBtn.getAttribute('aria-pressed')).toBe('false');
    click(lockBtn);
    expect(useDocumentStore.getState().browseLocked).toBe(true);
    // After the click the store flips; re-querying picks up the new label
    // (the JSX swaps the aria-label when locked).
    const unlockBtn = container.querySelector(
      'button[aria-label="Unlock document"]'
    ) as HTMLButtonElement;
    expect(unlockBtn).toBeTruthy();
    expect(unlockBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('Layout-mode dropdown flips between flow and radial', () => {
    const { container } = render(<TopBar />);
    // Default doc is a CRT (auto-layout), so the dropdown is visible.
    // Session 87 UX fix #3 reshaped the layout-mode control from an
    // icon-toggle button into an explicit two-option <select>.
    const select = container.querySelector('select[aria-label="Layout mode"]') as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(select.value).toBe('flow');
    // Drive the change via the native event the select element fires;
    // <option> elements aren't independently clickable in jsdom.
    act(() => {
      select.value = 'radial';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(useDocumentStore.getState().layoutMode).toBe('radial');
  });

  it('hides the layout-mode dropdown for manual-layout diagrams (EC)', () => {
    // EC is the only manual-layout diagram today. Swapping documents flips
    // the diagram type; the dropdown disappears because the EC geometry IS
    // the diagnostic — flipping to radial would erase the conflict.
    act(() => useDocumentStore.getState().newDocument('ec'));
    const { container } = render(<TopBar />);
    expect(container.querySelector('select[aria-label="Layout mode"]')).toBeNull();
  });

  it('Help button opens the help dialog', () => {
    const { container } = render(<TopBar />);
    const helpBtn = container.querySelector(
      'button[aria-label="Keyboard shortcuts"]'
    ) as HTMLButtonElement;
    expect(helpBtn).toBeTruthy();
    expect(useDocumentStore.getState().helpOpen).toBe(false);
    click(helpBtn);
    expect(useDocumentStore.getState().helpOpen).toBe(true);
  });

  it('Theme toggle flips between light and dark', () => {
    const { container } = render(<TopBar />);
    const themeBtn = container.querySelector(
      'button[aria-label="Toggle dark mode"]'
    ) as HTMLButtonElement;
    expect(themeBtn).toBeTruthy();
    expect(useDocumentStore.getState().theme).toBe('light');
    click(themeBtn);
    expect(useDocumentStore.getState().theme).toBe('dark');
    click(themeBtn);
    expect(useDocumentStore.getState().theme).toBe('light');
  });
});
