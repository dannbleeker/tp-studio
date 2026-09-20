import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OfflineReadinessSection } from '@/components/about/OfflineReadinessSection';
import { en } from '@/i18n/locales/en';

/**
 * The About dialog's diagnostics rows. The point of these tests is that the
 * section renders a readable answer in BOTH directions — a healthy install and
 * the "nothing is cached" install that produced the reported failure — because
 * a blank row tells a support conversation nothing.
 */

const defineNavigator = (key: string, value: unknown) => {
  Object.defineProperty(window.navigator, key, { configurable: true, value });
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window.navigator, 'serviceWorker');
  Reflect.deleteProperty(window.navigator, 'storage');
});

describe('OfflineReadinessSection', () => {
  it('labels every row so a screenshot is self-explanatory', () => {
    const { container } = render(<OfflineReadinessSection />);
    const text = container.textContent ?? '';
    expect(text).toContain(en.about.offline.heading);
    expect(text).toContain(en.about.offline.serviceWorker);
    expect(text).toContain(en.about.offline.ready);
    expect(text).toContain(en.about.offline.persisted);
    expect(text).toContain(en.about.offline.cachedSize);
  });

  it('shows the checking state until the probes resolve', () => {
    const { container } = render(<OfflineReadinessSection />);
    expect(container.querySelector('dl')?.getAttribute('aria-busy')).toBe('true');
    expect(container.textContent).toContain(en.about.offline.checking);
  });

  it('reports a healthy install', async () => {
    defineNavigator('serviceWorker', { getRegistration: () => Promise.resolve({ active: {} }) });
    defineNavigator('storage', {
      persisted: () => Promise.resolve(true),
      estimate: () => Promise.resolve({ usage: 2 * 1024 * 1024 }),
    });
    vi.stubGlobal('caches', {
      keys: () => Promise.resolve(['workbox-precache-v2-x']),
      open: () => Promise.resolve({ keys: () => Promise.resolve([{}, {}, {}]) }),
    });

    const { container } = render(<OfflineReadinessSection />);
    await waitFor(() =>
      expect(container.querySelector('dl')?.getAttribute('aria-busy')).toBe('false')
    );
    const text = container.textContent ?? '';
    expect(text).toContain(en.about.offline.swActive);
    expect(text).toContain(en.about.offline.readyYes({ count: 3 }));
    expect(text).toContain(en.about.offline.persistedYes);
    expect(text).toContain(en.about.offline.bytes({ mb: '2.0' }));
  });

  it('names the empty precache explicitly — the reported failure', async () => {
    defineNavigator('serviceWorker', { getRegistration: () => Promise.resolve(undefined) });
    vi.stubGlobal('caches', { keys: () => Promise.resolve([]) });

    const { container } = render(<OfflineReadinessSection />);
    await waitFor(() => expect(container.textContent).toContain(en.about.offline.readyNo));
    expect(container.textContent).toContain(en.about.offline.swUnregistered);
  });

  it('degrades to "not reported" rather than blank on a browser without the APIs', async () => {
    const { container } = render(<OfflineReadinessSection />);
    await waitFor(() =>
      expect(container.querySelector('dl')?.getAttribute('aria-busy')).toBe('false')
    );
    const text = container.textContent ?? '';
    expect(text).toContain(en.about.offline.swUnsupported);
    expect(text).toContain(en.about.offline.readyUnknown);
    expect(text).toContain(en.about.offline.persistedUnknown);
    expect(text).toContain(en.about.offline.cachedSizeUnknown);
  });
});
