import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TopBar } from '@/components/toolbar/TopBar';
import { resetStoreForTest, useDocumentStore } from '@/store';

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

  // Session 136 — the standalone Layout-mode `<select>` moved off the
  // TopBar into the kebab menu (per Dann's usage feedback: "the [Flow]
  // button on the canvas should be put into a menu"). The earlier
  // two TopBar tests for the dropdown migrated into
  // `tests/components/KebabMenu.test.tsx` ("Layout-mode menuitem flips
  // between flow and radial" + "omits the layout-mode item for
  // manual-layout diagrams (EC)"). The select shouldn't render here
  // anymore at any viewport.
  it('does NOT render the layout-mode dropdown in the topbar (moved to kebab in Session 136)', () => {
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
