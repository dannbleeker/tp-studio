import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CommandSearch } from '@/components/toolbar/CommandSearch';
import { resetStoreForTest, useDocumentStore } from '@/store';

beforeEach(resetStoreForTest);
afterEach(cleanup);

/**
 * CommandSearch is the centre command/search field. It looks like an input but
 * opens the ⌘K command palette (Session 182 — moved out of the TopBar). Coverage
 * of the palette-toggle that used to live in TopBar.test moved here with it.
 */
describe('CommandSearch', () => {
  it('opens the command palette when clicked', () => {
    const { container } = render(<CommandSearch />);
    const btn = container.querySelector(
      'button[aria-label="Search or run a command"]'
    ) as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(useDocumentStore.getState().paletteOpen).toBe(false);
    act(() => fireEvent.click(btn));
    expect(useDocumentStore.getState().paletteOpen).toBe(true);
  });

  it('collapses below the lg breakpoint (content-priority responsive)', () => {
    // The centre search field gives up its space first as the viewport
    // narrows so the title + right-hand clusters never wrap (redesign mockup
    // shows it lg+ only). ⌘K stays reachable via the shortcut + overflow menu.
    const { container } = render(<CommandSearch />);
    const btn = container.querySelector(
      'button[aria-label="Search or run a command"]'
    ) as HTMLButtonElement;
    expect(btn.className).toContain('hidden');
    expect(btn.className).toContain('lg:flex');
  });
});
