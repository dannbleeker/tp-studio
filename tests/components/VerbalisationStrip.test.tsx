import { VerbalisationStrip } from '@/components/inspector/VerbalisationStrip';
import { buildExampleEC } from '@/domain/examples/ec';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

beforeEach(resetStoreForTest);
afterEach(cleanup);

/**
 * Session 87 UX feedback — Option B for the verbalisation strip.
 * Default-collapsed in compact (canvas) mode; expanded on demand via
 * the chevron. Inspector-tab variant (non-compact) ignores the
 * collapse flag and always renders expanded.
 */

const seedECDoc = (): void => {
  useDocumentStore.setState({ doc: buildExampleEC() });
};

describe('VerbalisationStrip — collapsible canvas variant', () => {
  it('renders the collapsed summary by default in compact mode', () => {
    seedECDoc();
    const { container } = render(<VerbalisationStrip />);
    // Collapsed summary surfaces a "X/Y arrows with assumptions"
    // string. The full prose ("In order to achieve …") is hidden.
    expect(container.textContent).toMatch(/arrows with assumptions/);
    expect(container.textContent).not.toMatch(/In order to achieve/);
  });

  it('chevron click expands the strip and reveals the full prose', () => {
    seedECDoc();
    const { container } = render(<VerbalisationStrip />);
    const expandBtn = container.querySelector(
      'button[aria-label="Expand EC verbalisation"]'
    ) as HTMLButtonElement;
    expect(expandBtn).toBeTruthy();
    expect(expandBtn.getAttribute('aria-expanded')).toBe('false');
    act(() => {
      fireEvent.click(expandBtn);
    });
    // Now the full prose is rendered.
    expect(container.textContent).toMatch(/In order to achieve/);
    // And the collapse button appears.
    const collapseBtn = container.querySelector('button[aria-label="Collapse EC verbalisation"]');
    expect(collapseBtn).toBeTruthy();
    expect(useDocumentStore.getState().verbalisationStripCollapsed).toBe(false);
  });

  it('inspector-tab variant (non-compact) always renders expanded', () => {
    // Even with the default `verbalisationStripCollapsed: true` pref,
    // the inspector tab's variant should still show the full prose.
    seedECDoc();
    const { container } = render(<VerbalisationStrip compact={false} />);
    expect(container.textContent).toMatch(/In order to achieve/);
    // No expand-/collapse-button in the non-compact variant.
    expect(container.querySelector('button[aria-label="Expand EC verbalisation"]')).toBeNull();
    expect(container.querySelector('button[aria-label="Collapse EC verbalisation"]')).toBeNull();
  });

  it('returns null for non-EC docs', () => {
    // Default doc is a CRT — verbaliseEC returns an empty token list
    // and the strip should self-render to nothing.
    const { container } = render(<VerbalisationStrip />);
    expect(container.textContent).toBe('');
  });
});
