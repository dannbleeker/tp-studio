import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MarkdownPreview } from '@/components/ui/MarkdownPreview';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../helpers/seedDoc';

/**
 * Session 134 coverage push (round 2) — `MarkdownPreview` was at 0%.
 *
 * Smoke tests cover:
 *   - the empty-source placeholder
 *   - markdown → HTML rendering (a recognizable token from the input
 *     survives the DOMPurify sanitization step)
 *   - the `[data-entity-ref]` click delegator that drives FL-AN5
 *     cross-reference navigation
 */

beforeEach(resetStoreForTest);
afterEach(() => {
  resetStoreForTest();
  cleanup();
});

const s = () => useDocumentStore.getState();

describe('MarkdownPreview', () => {
  it('renders the empty-state placeholder when source is blank', () => {
    render(<MarkdownPreview source="" />);
    expect(screen.getByText(/No description/i)).toBeTruthy();
  });

  it('renders the empty-state placeholder when source is whitespace-only', () => {
    // JSX gotcha — escape sequences in attribute strings are literal text
    // ("\n" → backslash-n). Use a JS expression for a real whitespace string.
    render(<MarkdownPreview source={'   \n\t  '} />);
    expect(screen.getByText(/No description/i)).toBeTruthy();
  });

  it('renders inline content from the source', () => {
    const { container } = render(<MarkdownPreview source="Hello **world**" />);
    // The sanitizer keeps the `<strong>world</strong>` tag; the rendered
    // text should contain "world" with bold styling.
    expect(container.textContent).toContain('Hello');
    expect(container.textContent).toContain('world');
    expect(container.querySelector('strong')).not.toBeNull();
  });

  it('renders headings + lists from markdown', () => {
    const { container } = render(<MarkdownPreview source={'# Heading\n\n- one\n- two\n'} />);
    expect(container.querySelector('h1')?.textContent).toBe('Heading');
    expect(container.querySelectorAll('li').length).toBe(2);
  });

  it('clicks on [data-entity-ref] anchors resolve to a selection', () => {
    const e = seedEntity('Linked entity');
    // Clear the auto-selection seedEntity introduces — we want to assert
    // the click was what selected the entity, not the prior seed.
    useDocumentStore.getState().clearSelection();
    // Real Markdown link syntax with a numeric hash. `renderMarkdown`
    // rewrites `#N` hrefs to `data-entity-ref="#N"` via postProcessAnchors.
    const { container } = render(<MarkdownPreview source={`See [it](#${e.annotationNumber})`} />);
    const anchor = container.querySelector('[data-entity-ref]') as HTMLElement | null;
    expect(anchor).not.toBeNull();
    fireEvent.click(anchor!);
    const sel = s().selection;
    expect(sel.kind).toBe('entities');
    if (sel.kind !== 'entities') return;
    expect(sel.ids).toContain(e.id);
  });

  it('Enter key on a [data-entity-ref] anchor navigates the same way', () => {
    const e = seedEntity('Linked entity');
    useDocumentStore.getState().clearSelection();
    const { container } = render(<MarkdownPreview source={`See [it](#${e.annotationNumber})`} />);
    const anchor = container.querySelector('[data-entity-ref]') as HTMLElement | null;
    expect(anchor).not.toBeNull();
    fireEvent.keyDown(anchor!, { key: 'Enter' });
    const sel = s().selection;
    expect(sel.kind).toBe('entities');
    if (sel.kind !== 'entities') return;
    expect(sel.ids).toContain(e.id);
  });

  it('clicks on non-ref elements do not move selection', () => {
    seedEntity('Some entity');
    useDocumentStore.getState().clearSelection();
    const { container } = render(<MarkdownPreview source="Just plain text." />);
    const div = container.firstChild as HTMLElement;
    fireEvent.click(div);
    expect(s().selection.kind).toBe('none');
  });
});
