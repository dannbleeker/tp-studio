import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ReaderModeBanner } from '@/components/canvas/overlays/ReaderModeBanner';

/**
 * Session 180 / E6 — ReaderModeBanner smoke tests.
 *
 * The banner floats above the canvas and shows the diagram-type
 * reading rule (from printLegendFor). Freeform diagrams produce an
 * empty string from printLegendFor → the component returns null.
 */

afterEach(cleanup);

describe('ReaderModeBanner', () => {
  it('renders reading rule text for CRT diagram type', () => {
    const { getByRole } = render(<ReaderModeBanner diagramType="crt" />);
    // CRT reading rule mentions "bottom-up" or "Current Reality Tree"
    // The banner truncates at the first sentence, but it should contain
    // some meaningful text from printLegendFor('crt').
    // Role is "note" (informational, non-interactive region).
    const banner = getByRole('note');
    expect(banner.textContent).toMatch(/Current Reality|bottom.up|read/i);
  });

  it('renders reading rule text for Goal Tree diagram type', () => {
    const { getByRole } = render(<ReaderModeBanner diagramType="goalTree" />);
    const banner = getByRole('note');
    expect(banner.textContent?.length ?? 0).toBeGreaterThan(5);
  });

  it('renders null for freeform (printLegendFor returns empty string)', () => {
    const { container } = render(<ReaderModeBanner diagramType="freeform" />);
    expect(container.firstChild).toBeNull();
  });

  it('shows a dismiss button', () => {
    const { getByRole } = render(<ReaderModeBanner diagramType="crt" />);
    // The button's aria-label is "Dismiss reading guide"
    expect(getByRole('button', { name: /dismiss/i })).toBeDefined();
  });

  it('hides the banner after dismiss button is clicked', () => {
    const { container, getByRole } = render(<ReaderModeBanner diagramType="crt" />);
    const dismiss = getByRole('button', { name: /dismiss/i });
    fireEvent.click(dismiss);
    // After dismiss the component returns null (no root element)
    expect(container.firstChild).toBeNull();
  });
});
