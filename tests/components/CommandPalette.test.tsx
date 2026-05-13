import { CommandPalette } from '@/components/command-palette/CommandPalette';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

beforeEach(resetStoreForTest);
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
    // Export / Help order. Headers are <li aria-hidden> rows with no <button>
    // inside — querySelectorAll('li[aria-hidden]') is the cleanest way to
    // grab them.
    open();
    const { container } = render(<CommandPalette />);
    const headers = Array.from(container.querySelectorAll('li[aria-hidden="true"]')).map(
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
});
