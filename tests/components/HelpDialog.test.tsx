import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HelpDialog } from '@/components/help/HelpDialog';
import { resetStoreForTest, useDocumentStore } from '@/store';

beforeEach(resetStoreForTest);
afterEach(cleanup);

/**
 * HelpDialog is a content-only modal: open/close + a static list of shortcut
 * sections. The tests pin three things — gated rendering, the section
 * headings the user sees, and the close button — so a future refactor that
 * loses any of them shows up in CI rather than at runtime.
 */

const open = (): void => {
  act(() => useDocumentStore.getState().openHelp());
};

describe('HelpDialog', () => {
  it('renders nothing when helpOpen is false', () => {
    const { container } = render(<HelpDialog />);
    expect(container.querySelector('dialog')).toBeNull();
  });

  it('renders the title and the four shortcut sections when open', () => {
    open();
    const { getByText } = render(<HelpDialog />);
    expect(getByText('Help')).toBeTruthy();
    // Section headings as they appear in `SECTIONS` above.
    expect(getByText('Global')).toBeTruthy();
    expect(getByText('On a selected entity')).toBeTruthy();
    expect(getByText('On a selected group')).toBeTruthy();
    expect(getByText('Canvas')).toBeTruthy();
  });

  it('leads with a "Learn TP Studio" section linking the User Guide + book', () => {
    // Session 153 — the "?" is now a real Help entry, not just a shortcuts list.
    open();
    const { getByText, container } = render(<HelpDialog />);
    expect(getByText('Learn TP Studio')).toBeTruthy();
    const hrefs = Array.from(container.querySelectorAll('a[href]')).map((a) =>
      a.getAttribute('href')
    );
    expect(hrefs).toContain('/user-guide.html');
    expect(hrefs).toContain('/Causal-Thinking-with-TP-Studio.pdf');
  });

  it('renders representative shortcut rows', () => {
    open();
    const { getByText } = render(<HelpDialog />);
    expect(getByText('Command palette')).toBeTruthy();
    expect(getByText('Quick Capture (paste an indented list)')).toBeTruthy();
    expect(getByText('Add child entity')).toBeTruthy();
  });

  it('Close button closes the dialog', () => {
    open();
    const { container } = render(<HelpDialog />);
    const close = container.querySelector('button[aria-label="Close help"]') as HTMLButtonElement;
    expect(close).toBeTruthy();
    act(() => fireEvent.click(close));
    expect(useDocumentStore.getState().helpOpen).toBe(false);
  });
});
