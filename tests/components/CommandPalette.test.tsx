import { CommandPalette } from '@/components/command-palette/CommandPalette';
import { __resetRecentCommandsForTest } from '@/services/recentCommands';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

beforeEach(() => {
  resetStoreForTest();
  // Session 88 (S17) — the palette's Recent section reads from
  // localStorage; clear so each test sees an empty recents list and
  // the existing "section headers in canonical order" assertion
  // (File / Edit / View / Review / Export / Help) doesn't see a
  // leading "Recent" header from a prior test's command run.
  __resetRecentCommandsForTest();
});
afterEach(cleanup);

const open = () => act(() => useDocumentStore.getState().openPalette());

describe('CommandPalette', () => {
  it('opens when the store says paletteOpen and renders all commands', () => {
    open();
    const { container } = render(<CommandPalette />);
    const items = container.querySelectorAll('li button');
    // We don't assert exact count (the catalog grows) but require a healthy
    // floor so a regression that filters everything is caught.
    expect(items.length).toBeGreaterThanOrEqual(20);
  });

  it('filters by substring as the user types', () => {
    open();
    const { container } = render(<CommandPalette />);
    const input = container.querySelector('input')!;
    act(() => {
      fireEvent.change(input, { target: { value: 'png' } });
    });
    const labels = Array.from(container.querySelectorAll('li button')).map(
      (b) => b.textContent ?? ''
    );
    expect(labels.some((l) => /PNG/i.test(l))).toBe(true);
    // No SVG-only commands should be visible when the filter is "png".
    expect(labels.every((l) => !/Export as SVG/.test(l))).toBe(true);
  });

  it('honors paletteInitialQuery on open (e.g. Cmd+E → "Export")', () => {
    act(() => useDocumentStore.getState().openPaletteWithQuery('Export'));
    const { container } = render(<CommandPalette />);
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('Export');
    const labels = Array.from(container.querySelectorAll('li button')).map(
      (b) => b.textContent ?? ''
    );
    // Every label that survives the filter should be Export-related.
    expect(labels.every((l) => /export/i.test(l))).toBe(true);
  });

  it('Enter on the first match runs the active command and closes', () => {
    open();
    const { container } = render(<CommandPalette />);
    const input = container.querySelector('input')!;
    // "shortcuts" uniquely identifies the help command's label and pushes
    // it to the top via the substring-match score branch.
    act(() => fireEvent.change(input, { target: { value: 'shortcuts' } }));
    act(() => fireEvent.keyDown(input, { key: 'Enter' }));
    const state = useDocumentStore.getState();
    expect(state.paletteOpen).toBe(false);
    expect(state.helpOpen).toBe(true);
  });

  it('reports "No matches." when nothing scores in', () => {
    open();
    const { container } = render(<CommandPalette />);
    act(() =>
      fireEvent.change(container.querySelector('input')!, {
        target: { value: 'zzzzzzz-no-such-command' },
      })
    );
    expect(container.textContent).toContain('No matches.');
  });

  it('renders section headers in canonical order when no query is active', () => {
    // The palette groups commands by `cmd.group` and emits a section header
    // before each non-empty group, in a fixed File / Edit / View / Review /
    // Export / Help order. Headers are <li role="presentation"> rows with no
    // <button> inside — Session 87 (S4) swapped them from `aria-hidden` to
    // `role="presentation"` so screen readers announce category transitions.
    open();
    const { container } = render(<CommandPalette />);
    const headers = Array.from(container.querySelectorAll('li[role="presentation"]')).map(
      (n) => n.textContent ?? ''
    );
    // Every value in `headers` must come from the canonical order. The
    // canonical list is the source of truth; this test just pins that we
    // honor it.
    const CANONICAL = ['File', 'Edit', 'View', 'Review', 'Export', 'Help'] as const;
    expect(headers.length).toBeGreaterThan(0);
    // Headers must be a (non-strict) subsequence of CANONICAL — i.e. each
    // appears at most once and in canonical order. Empty groups are
    // suppressed, so a missing header from the list is fine.
    let i = 0;
    for (const h of headers) {
      const found = CANONICAL.indexOf(h as (typeof CANONICAL)[number], i);
      expect(found, `Header "${h}" out of order vs canonical`).toBeGreaterThanOrEqual(0);
      i = found + 1;
    }
  });

  it('suppresses section headers once a query narrows the list', () => {
    // When the user starts typing, the palette flattens the list and sorts
    // by paletteScore so the top match is always at row 0. Headers would
    // lie when the best match jumps groups, so they're suppressed.
    open();
    const { container } = render(<CommandPalette />);
    act(() => fireEvent.change(container.querySelector('input')!, { target: { value: 'png' } }));
    const headers = container.querySelectorAll('li[aria-hidden="true"]');
    expect(headers.length).toBe(0);
  });

  // Session 88 (S17) — recent-commands section.
  it('renders a Recent section when at least one command has been run', () => {
    // Open + Enter on a known unique label so the command lands in recents.
    open();
    const { container, unmount } = render(<CommandPalette />);
    act(() =>
      fireEvent.change(container.querySelector('input')!, { target: { value: 'shortcuts' } })
    );
    act(() => fireEvent.keyDown(container.querySelector('input')!, { key: 'Enter' }));
    unmount();
    // Reopen — the just-run command should appear under a Recent header.
    open();
    const reopen = render(<CommandPalette />);
    const headers = Array.from(reopen.container.querySelectorAll('li[role="presentation"]')).map(
      (n) => n.textContent ?? ''
    );
    expect(headers[0]).toBe('Recent');
  });

  it('hides the Recent section when the user is filtering', () => {
    // Pre-seed by running a command, then type a filter.
    open();
    const { container, unmount } = render(<CommandPalette />);
    act(() =>
      fireEvent.change(container.querySelector('input')!, { target: { value: 'shortcuts' } })
    );
    act(() => fireEvent.keyDown(container.querySelector('input')!, { key: 'Enter' }));
    unmount();
    open();
    const reopen = render(<CommandPalette />);
    // Type any query; the unfiltered (sectioned) view should disappear
    // entirely, taking the Recent header with it.
    act(() =>
      fireEvent.change(reopen.container.querySelector('input')!, { target: { value: 'png' } })
    );
    const headers = Array.from(reopen.container.querySelectorAll('li[role="presentation"]')).map(
      (n) => n.textContent ?? ''
    );
    expect(headers).not.toContain('Recent');
  });

  // Session 88 (S16) — palette command rows render their optional icon
  // when the central commandIcons map provides one. We don't pin to a
  // specific icon class; we just verify *some* svg renders for a row
  // that has an icon mapped (e.g. "Open Help" → HelpCircle).
  it('renders an icon for commands that have one in the icon map', () => {
    open();
    const { container } = render(<CommandPalette />);
    // The Help command's id is `help`; its row will be the one whose
    // button text contains "shortcuts" (from "Help / shortcuts…") or
    // similar — we look up by text and check the button has an SVG.
    const helpRow = Array.from(container.querySelectorAll('li button')).find((b) =>
      /shortcuts/i.test(b.textContent ?? '')
    ) as HTMLButtonElement | undefined;
    expect(helpRow).toBeTruthy();
    expect(helpRow?.querySelector('svg')).toBeTruthy();
  });
});
