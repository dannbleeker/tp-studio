import { KebabMenu } from '@/components/toolbar/KebabMenu';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

beforeEach(resetStoreForTest);
afterEach(cleanup);

/**
 * KebabMenu surfaces the buttons hidden below the `sm` breakpoint (640 px) —
 * History, Help, Theme, and Layout Mode — behind a single icon. Without it,
 * touch users on phones can't reach those actions without a hardware
 * keyboard for the palette.
 *
 * The dropdown is keyed off local state, so each test toggles the trigger,
 * fires the menuitem, and asserts on the store side-effect.
 */

const click = (el: Element): void => {
  act(() => fireEvent.click(el));
};

const openMenu = (container: HTMLElement): void => {
  const trigger = container.querySelector('button[aria-label="More actions"]') as HTMLButtonElement;
  expect(trigger).toBeTruthy();
  click(trigger);
};

describe('KebabMenu', () => {
  it('renders nothing in the menu until opened', () => {
    const { container } = render(<KebabMenu />);
    // Trigger is always rendered (its `sm:hidden` parent doesn't affect JSDOM).
    expect(container.querySelector('button[aria-label="More actions"]')).toBeTruthy();
    // No menuitems before the trigger is clicked.
    expect(container.querySelectorAll('[role="menuitem"]').length).toBe(0);
  });

  it('opens and closes when the trigger is clicked twice', () => {
    const { container } = render(<KebabMenu />);
    openMenu(container);
    expect(container.querySelectorAll('[role="menuitem"]').length).toBeGreaterThan(0);
    // Click again to close.
    const trigger = container.querySelector(
      'button[aria-label="More actions"]'
    ) as HTMLButtonElement;
    click(trigger);
    expect(container.querySelectorAll('[role="menuitem"]').length).toBe(0);
  });

  it('History menuitem toggles the history panel and closes the menu', () => {
    const { container } = render(<KebabMenu />);
    openMenu(container);
    const historyItem = Array.from(container.querySelectorAll('[role="menuitem"]')).find((b) =>
      b.textContent?.includes('Open history')
    ) as HTMLButtonElement;
    expect(historyItem).toBeTruthy();
    expect(useDocumentStore.getState().historyPanelOpen).toBe(false);
    click(historyItem);
    expect(useDocumentStore.getState().historyPanelOpen).toBe(true);
    // Menu auto-closes after activation.
    expect(container.querySelectorAll('[role="menuitem"]').length).toBe(0);
  });

  it('Help menuitem opens the help dialog', () => {
    const { container } = render(<KebabMenu />);
    openMenu(container);
    const helpItem = Array.from(container.querySelectorAll('[role="menuitem"]')).find((b) =>
      b.textContent?.includes('Keyboard shortcuts')
    ) as HTMLButtonElement;
    expect(helpItem).toBeTruthy();
    expect(useDocumentStore.getState().helpOpen).toBe(false);
    click(helpItem);
    expect(useDocumentStore.getState().helpOpen).toBe(true);
  });

  it('Theme menuitem flips between light and dark', () => {
    const { container } = render(<KebabMenu />);
    openMenu(container);
    const darkItem = Array.from(container.querySelectorAll('[role="menuitem"]')).find((b) =>
      b.textContent?.includes('Dark mode')
    ) as HTMLButtonElement;
    expect(darkItem).toBeTruthy();
    click(darkItem);
    expect(useDocumentStore.getState().theme).toBe('dark');
    // Re-open and verify the label flipped to "Light mode".
    openMenu(container);
    const lightItem = Array.from(container.querySelectorAll('[role="menuitem"]')).find((b) =>
      b.textContent?.includes('Light mode')
    ) as HTMLButtonElement;
    expect(lightItem).toBeTruthy();
    click(lightItem);
    expect(useDocumentStore.getState().theme).toBe('light');
  });

  it('Layout-mode menuitem flips between flow and radial', () => {
    const { container } = render(<KebabMenu />);
    openMenu(container);
    const toRadial = Array.from(container.querySelectorAll('[role="menuitem"]')).find((b) =>
      b.textContent?.includes('Radial layout')
    ) as HTMLButtonElement;
    expect(toRadial).toBeTruthy();
    click(toRadial);
    expect(useDocumentStore.getState().layoutMode).toBe('radial');
  });

  it('omits the layout-mode item for manual-layout diagrams (EC)', () => {
    act(() => useDocumentStore.getState().newDocument('ec'));
    const { container } = render(<KebabMenu />);
    openMenu(container);
    const labels = Array.from(container.querySelectorAll('[role="menuitem"]')).map(
      (b) => b.textContent ?? ''
    );
    expect(labels.some((t) => t.includes('Radial layout'))).toBe(false);
    expect(labels.some((t) => t.includes('Flow layout'))).toBe(false);
    // Help/Theme/History still present.
    expect(labels.some((t) => t.includes('Keyboard shortcuts'))).toBe(true);
  });

  it('closes when Escape is pressed', () => {
    const { container } = render(<KebabMenu />);
    openMenu(container);
    expect(container.querySelectorAll('[role="menuitem"]').length).toBeGreaterThan(0);
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(container.querySelectorAll('[role="menuitem"]').length).toBe(0);
  });

  it('focuses the first menuitem on open', () => {
    const { container } = render(<KebabMenu />);
    openMenu(container);
    const items = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
    expect(items.length).toBeGreaterThan(0);
    expect(document.activeElement).toBe(items[0]);
  });

  it('reflects the doc-type change while open: layout item disappears when switching to EC', () => {
    const { container } = render(<KebabMenu />);
    openMenu(container);
    // Default doc is CRT — layout item is present.
    expect(
      Array.from(container.querySelectorAll('[role="menuitem"]')).some((b) =>
        b.textContent?.includes('Radial layout')
      )
    ).toBe(true);
    // Swap to EC (manual-layout) while the menu is open.
    act(() => useDocumentStore.getState().newDocument('ec'));
    // The KebabMenu re-renders from the store; the layout item should
    // be filtered out now. The menu may or may not stay open after a
    // doc swap — both behaviors are acceptable; what matters is that
    // if it IS open, the items list is consistent with the new doc.
    const labels = Array.from(container.querySelectorAll('[role="menuitem"]')).map(
      (b) => b.textContent ?? ''
    );
    expect(labels.some((t) => t.includes('Radial layout'))).toBe(false);
    expect(labels.some((t) => t.includes('Flow layout'))).toBe(false);
  });

  it('ArrowDown / ArrowUp cycle focus between menuitems', () => {
    const { container } = render(<KebabMenu />);
    openMenu(container);
    const items = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
    const menu = container.querySelector('[role="menu"]') as HTMLElement;
    expect(menu).toBeTruthy();
    expect(document.activeElement).toBe(items[0]);

    act(() => {
      fireEvent.keyDown(menu, { key: 'ArrowDown' });
    });
    expect(document.activeElement).toBe(items[1]);

    act(() => {
      fireEvent.keyDown(menu, { key: 'ArrowUp' });
    });
    expect(document.activeElement).toBe(items[0]);

    // Wrap-around: ArrowUp from first goes to last.
    act(() => {
      fireEvent.keyDown(menu, { key: 'ArrowUp' });
    });
    expect(document.activeElement).toBe(items[items.length - 1]);
  });
});
