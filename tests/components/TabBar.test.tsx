import { TabBar } from '@/components/workspace/TabBar';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * FL-EX8 — multi-doc workspace tab bar.
 *
 * The bar's central UX contract: invisible when only one tab is
 * open (single-doc users see no change), then surfaces tabs the
 * moment a second one exists. Tests target the visibility threshold,
 * the click-to-switch path, and the close-X path. Slice-level
 * behavior (the doc archive ↔ swap math, history isolation) lives
 * in tests/store/workspaceSlice.test.ts so this file stays a thin
 * shell over rendering.
 */

beforeEach(resetStoreForTest);
afterEach(cleanup);

describe('TabBar', () => {
  it('renders nothing when only one tab is open', () => {
    const { container } = render(<TabBar />);
    // The bar's root element should not be present in the DOM.
    expect(container.querySelector('[data-component="tab-bar"]')).toBeNull();
  });

  it('renders one chip per tab once a second tab is opened', () => {
    act(() => useDocumentStore.getState().openNewTab('ec'));
    const { container } = render(<TabBar />);
    const root = container.querySelector('[data-component="tab-bar"]');
    expect(root).not.toBeNull();
    // Two tabs → at least two title-bearing buttons (close buttons
    // are also present but carry aria-label="Close …" so we filter
    // by title-text buttons).
    const titleButtons = root!.querySelectorAll('button[aria-current], button[title]');
    // 2 active/inactive title buttons + 2 close buttons (the close
    // buttons also carry a `title` attr) → 4 matches; filter to the
    // ones that aren't close buttons to avoid magic numbers.
    const tabTitleButtons = Array.from(titleButtons).filter(
      (b) => !b.getAttribute('aria-label')?.startsWith('Close ')
    );
    expect(tabTitleButtons).toHaveLength(2);
  });

  it('clicking an inactive tab switches the active doc', () => {
    const state = useDocumentStore.getState();
    const firstTabId = state.doc.id;
    act(() => state.openNewTab('ec'));
    // The second tab is active now; render the bar and click the first.
    const { container } = render(<TabBar />);
    const root = container.querySelector('[data-component="tab-bar"]');
    const firstTabButton = Array.from(
      root!.querySelectorAll('button[aria-current], button[title]')
    ).find((b) => !b.getAttribute('aria-label')?.startsWith('Close ')) as
      | HTMLButtonElement
      | undefined;
    expect(firstTabButton).toBeTruthy();
    act(() => fireEvent.click(firstTabButton!));
    expect(useDocumentStore.getState().doc.id).toBe(firstTabId);
  });

  it("clicking a chip's close X removes that tab", () => {
    act(() => useDocumentStore.getState().openNewTab('frt'));
    const { container } = render(<TabBar />);
    const root = container.querySelector('[data-component="tab-bar"]');
    const closeButtons = Array.from(
      root!.querySelectorAll('button[aria-label^="Close "]')
    ) as HTMLButtonElement[];
    expect(closeButtons.length).toBeGreaterThan(0);
    // Close the first one — semantics are exercised in slice tests;
    // here we just verify the click reaches the action.
    act(() => fireEvent.click(closeButtons[0]!));
    expect(useDocumentStore.getState().workspace.tabs).toHaveLength(1);
  });

  it("reflects the active doc's title in its tab chip", () => {
    act(() => useDocumentStore.getState().openNewTab('crt'));
    act(() => useDocumentStore.getState().setTitle('My new diagram'));
    const { container } = render(<TabBar />);
    const root = container.querySelector('[data-component="tab-bar"]');
    expect(root!.textContent).toContain('My new diagram');
  });
});
