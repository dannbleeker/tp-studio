import { AboutDialog } from '@/components/about/AboutDialog';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

beforeEach(resetStoreForTest);
afterEach(cleanup);

/**
 * Session 111 — About TP Studio dialog.
 *
 * Tests pin five contracts: gated rendering, the headline tagline, the
 * five informational links (book / user guide / security / notices /
 * GitHub) with their on-brand `/...` URLs (not GitHub leaks), the
 * close button, and the build-metadata strings injected via Vite
 * `define`. Vitest sees those as runtime string literals once Vite
 * has rewritten the file — but in plain ts-node test execution the
 * defines aren't applied, so we declare them as module-level
 * `globalThis` fallbacks for vitest's test transform.
 */

// Vitest doesn't apply Vite's `define` substitutions outside the
// app bundle, so the AboutDialog's `__APP_VERSION__` /
// `__BUILD_DATE__` / `__COPYRIGHT_YEARS__` reads would otherwise hit
// the unresolved global at render time. Seed sensible test values on
// `globalThis` so the dialog renders consistently.
(globalThis as Record<string, unknown>).__APP_VERSION__ = '0.0.0-test';
(globalThis as Record<string, unknown>).__BUILD_DATE__ = '2026-05-17';
(globalThis as Record<string, unknown>).__COPYRIGHT_YEARS__ = '2026';

const open = (): void => {
  act(() => useDocumentStore.getState().openAbout());
};

describe('AboutDialog', () => {
  it('renders nothing when aboutOpen is false', () => {
    const { container } = render(<AboutDialog />);
    expect(container.querySelector('dialog')).toBeNull();
  });

  it('renders the headline tagline when open (no Flying Logic reference)', () => {
    open();
    const { getByText, queryAllByText } = render(<AboutDialog />);
    expect(getByText(/practitioner-focused canvas/i)).toBeTruthy();
    expect(getByText(/Theory of Constraints Thinking Process/i)).toBeTruthy();
    // The tagline must NOT carry the "alternative to Flying Logic"
    // phrasing — the Session 109/110/111 reframing removed that
    // comparative anchor from user-facing copy. The trademark
    // notice in the footer is a separate, intentional reference.
    const taglineHits = queryAllByText(/alternative to Flying Logic/);
    expect(taglineHits.length).toBe(0);
  });

  it('renders the Read-more section with on-brand (not GitHub) URLs', () => {
    open();
    const { getByText, container } = render(<AboutDialog />);
    expect(getByText('Read more')).toBeTruthy();
    const links = Array.from(container.querySelectorAll('a[href]'));
    const hrefs = links.map((a) => a.getAttribute('href'));
    // Each doc URL is bundled into the Vite output as a relative
    // path served from the branded subdomain. github.com is allowed
    // ONLY for the explicit Source-code link.
    expect(hrefs).toContain('/Causal-Thinking-with-TP-Studio.pdf');
    expect(hrefs).toContain('/user-guide.html');
    expect(hrefs).toContain('/security.html');
    expect(hrefs).toContain('/notices.html');
  });

  it('renders exactly one GitHub link (the explicit Source-code row)', () => {
    open();
    const { container } = render(<AboutDialog />);
    const links = Array.from(container.querySelectorAll('a[href]'));
    const githubHits = links.filter((a) => (a.getAttribute('href') ?? '').includes('github.com'));
    expect(githubHits.length).toBe(1);
    const first = githubHits[0];
    expect(first).toBeDefined();
    expect(first?.getAttribute('href')).toBe('https://github.com/dannbleeker/tp-studio');
  });

  it('renders the build metadata + copyright string', () => {
    open();
    const { getByText } = render(<AboutDialog />);
    expect(getByText(/Version 0\.0\.0-test/)).toBeTruthy();
    expect(getByText(/Build 2026-05-17/)).toBeTruthy();
    // Footer carries copyright + trademark notice. The year is
    // dynamically computed at build time; here it's the seeded test
    // value (2026), but the wider contract is that whatever the
    // build-time __COPYRIGHT_YEARS__ resolves to ends up in the DOM.
    expect(getByText(/© 2026 Dann Pedersen/)).toBeTruthy();
    expect(getByText(/Flying Logic.*trademark/i)).toBeTruthy();
  });

  it('Close button closes the dialog', () => {
    open();
    const { container } = render(<AboutDialog />);
    const close = container.querySelector('button[aria-label="Close about"]') as HTMLButtonElement;
    expect(close).toBeTruthy();
    act(() => fireEvent.click(close));
    expect(useDocumentStore.getState().aboutOpen).toBe(false);
  });

  it('store toggle round-trips through openAbout / closeAbout', () => {
    expect(useDocumentStore.getState().aboutOpen).toBe(false);
    act(() => useDocumentStore.getState().openAbout());
    expect(useDocumentStore.getState().aboutOpen).toBe(true);
    act(() => useDocumentStore.getState().closeAbout());
    expect(useDocumentStore.getState().aboutOpen).toBe(false);
  });
});
