import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TopBar } from '@/components/toolbar/TopBar';
import { resetStoreForTest, useDocumentStore } from '@/store';

beforeEach(resetStoreForTest);
afterEach(cleanup);

/**
 * TopBar drives the top bar's RIGHT zone after the Session-182 regroup:
 *   - Logic chip (toggles the CLR panel)
 *   - Undo / Redo cluster
 *   - History / Comments cluster
 *   - Share (copy share link) + Export (filled primary)
 *   - the overflow ▾ (KebabMenu)
 *
 * The command/search field (centre) and the theme / lock / help / inspector
 * controls moved out — search is now `CommandSearch` (see its own test) and the
 * rest live in the overflow (see `KebabMenu.test.tsx`). We query by `aria-label`
 * because the icon-only controls have no visible text.
 */

const click = (el: Element): void => {
  act(() => fireEvent.click(el));
};

describe('TopBar', () => {
  it('Logic chip toggles the CLR panel', () => {
    const { container } = render(<TopBar />);
    const chip = container.querySelector('button[aria-label^="Logic check"]') as HTMLButtonElement;
    expect(chip).toBeTruthy();
    expect(useDocumentStore.getState().clrPanelOpen).toBe(false);
    click(chip);
    expect(useDocumentStore.getState().clrPanelOpen).toBe(true);
  });

  it('Export button opens the export picker', () => {
    const { container } = render(<TopBar />);
    const exportBtn = container.querySelector('button[aria-label="Export"]') as HTMLButtonElement;
    expect(exportBtn).toBeTruthy();
    expect(useDocumentStore.getState().exportPickerOpen).toBe(false);
    click(exportBtn);
    expect(useDocumentStore.getState().exportPickerOpen).toBe(true);
  });

  it('surfaces Undo / Redo controls', () => {
    const { container } = render(<TopBar />);
    expect(container.querySelector('button[aria-label="Undo"]')).toBeTruthy();
    expect(container.querySelector('button[aria-label="Redo"]')).toBeTruthy();
  });

  it('surfaces the Share control', () => {
    const { container } = render(<TopBar />);
    expect(container.querySelector('button[aria-label="Copy share link"]')).toBeTruthy();
  });

  it('does NOT render the layout-mode dropdown in the topbar (it lives in the overflow)', () => {
    const { container } = render(<TopBar />);
    expect(container.querySelector('select[aria-label="Layout mode"]')).toBeNull();
  });
});
