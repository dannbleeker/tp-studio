import { cleanup, render } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrintReasoning } from '@/components/print/PrintReasoning';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedChain } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);
afterEach(cleanup);

/**
 * The print "reasoning companion" — a print-only DOM block (always in the DOM,
 * `display: none` on screen via print.css) listing the diagram's cause→effect
 * read-out. Mirrors the PrintAppendix pattern.
 */
describe('PrintReasoning', () => {
  it('renders the reasoning sentences as a numbered list', () => {
    seedChain(['A', 'B', 'C']);
    const { container } = render(<PrintReasoning />);
    expect(container.querySelector('[data-component="print-reasoning"]')).toBeTruthy();
    expect(container.textContent).toContain('Reasoning');
    // CRT default 'auto' reads effect-first: "B" because "A".
    expect(container.textContent).toContain('"B" because "A".');
    expect(container.querySelectorAll('ol > li')).toHaveLength(2);
  });

  it('shows a placeholder (no list) when there are no edges', () => {
    const { container } = render(<PrintReasoning />);
    expect(container.textContent).toContain('No edges drawn yet');
    expect(container.querySelector('ol')).toBeNull();
  });

  it('renders a fresh EC (identical empty-box readings) without duplicate-key warnings', () => {
    // A fresh EC has five empty boxes, so every arrow reads the same sentence.
    // The list keys by position, not text, so React must not warn about
    // duplicate keys (which "may cause children to be duplicated and/or omitted").
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    act(() => useDocumentStore.getState().newDocument('ec'));
    render(<PrintReasoning />);
    const keyWarnings = errSpy.mock.calls.filter((c) => String(c[0]).includes('same key'));
    expect(keyWarnings).toEqual([]);
    errSpy.mockRestore();
  });
});
