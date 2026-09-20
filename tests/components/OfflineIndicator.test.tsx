import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { OfflineIndicator } from '@/components/toolbar/OfflineIndicator';
import { en } from '@/i18n/locales/en';

/**
 * The TopBar's offline chip. Local-first means an offline session is fine —
 * the chip exists so a failed export or a stalled load reads as "no network",
 * not "the app is broken".
 *
 * The live-region wrapper is asserted explicitly: it has to stay mounted while
 * ONLINE for screen readers to announce the transition, so "renders nothing"
 * must mean "renders no chip", not "renders no element".
 */

const setOnLine = (value: boolean) => {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => value,
  });
};

const goOffline = () => {
  act(() => {
    setOnLine(false);
    window.dispatchEvent(new Event('offline'));
  });
};

afterEach(() => {
  cleanup();
  setOnLine(true);
});

describe('OfflineIndicator', () => {
  it('shows no chip while online', () => {
    const { container } = render(<OfflineIndicator />);
    expect(container.textContent).toBe('');
    expect(container.querySelector('span')).toBeNull();
  });

  it('keeps the live region mounted while online so the transition is announced', () => {
    const { container } = render(<OfflineIndicator />);
    const region = container.querySelector('[data-component="offline-indicator"]');
    expect(region).not.toBeNull();
    expect(region?.getAttribute('role')).toBe('status');
    expect(region?.getAttribute('aria-live')).toBe('polite');
  });

  it('renders the offline copy from the catalogue once the browser drops off', () => {
    const { container } = render(<OfflineIndicator />);
    goOffline();
    expect(container.textContent).toContain(en.toolbar.offlineLabel);
    expect(container.textContent).toContain(en.toolbar.offlineNote);
  });

  it('carries real text, not just an icon colour', () => {
    setOnLine(false);
    const { getByRole } = render(<OfflineIndicator />);
    // `role="status"` is the accessible name-less live region; its text
    // content is what a screen reader reads out.
    expect(getByRole('status').textContent?.trim().length ?? 0).toBeGreaterThan(0);
  });

  it('explains the situation in the title tooltip', () => {
    setOnLine(false);
    const { container } = render(<OfflineIndicator />);
    expect(container.querySelector(`[title="${en.toolbar.offlineTitle}"]`)).not.toBeNull();
  });

  it('clears the chip again when the connection returns', () => {
    const { container } = render(<OfflineIndicator />);
    goOffline();
    expect(container.textContent).toContain(en.toolbar.offlineLabel);
    act(() => {
      setOnLine(true);
      window.dispatchEvent(new Event('online'));
    });
    expect(container.textContent).toBe('');
  });
});
