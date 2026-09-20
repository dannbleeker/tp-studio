import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { probeOfflineReadiness, useOfflineReadiness } from '@/hooks/useOfflineReadiness';

/**
 * The About dialog's offline-readiness diagnostics.
 *
 * The whole value of this panel is that it reports SOMETHING on every browser —
 * a panel that throws (or renders blank) on the machine where offline broke is
 * worse than no panel. So the cases below are the three shapes reality takes:
 * the API is there, the API is missing, and the API is there but says no.
 * jsdom supplies none of the four, which makes it the "unsupported" case for
 * free.
 */

/** Define an own-property on `navigator` that jsdom does not ship. */
const defineNavigator = (key: string, value: unknown) => {
  Object.defineProperty(window.navigator, key, { configurable: true, value });
};

const undefineNavigator = (key: string) => {
  // `delete` is the only way back to "property absent", which is what the
  // `'serviceWorker' in navigator` / `typeof storage.persisted` guards read.
  Reflect.deleteProperty(window.navigator, key);
};

const cacheStorageWith = (caches: Record<string, number>) => ({
  keys: () => Promise.resolve(Object.keys(caches)),
  open: (name: string) =>
    Promise.resolve({
      keys: () => Promise.resolve(Array.from({ length: caches[name] ?? 0 }, () => ({}))),
    }),
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  undefineNavigator('serviceWorker');
  undefineNavigator('storage');
});

describe('probeOfflineReadiness — nothing supported', () => {
  it('reports every field as unknown rather than throwing', async () => {
    const readiness = await probeOfflineReadiness();
    expect(readiness).toEqual({
      probed: true,
      serviceWorker: 'unsupported',
      precachedEntries: null,
      persisted: 'unknown',
      usageBytes: null,
    });
  });
});

describe('probeOfflineReadiness — service worker states', () => {
  const withRegistration = (registration: unknown) =>
    defineNavigator('serviceWorker', { getRegistration: () => Promise.resolve(registration) });

  it('reports "active" when a worker is serving', async () => {
    withRegistration({ active: {} });
    expect((await probeOfflineReadiness()).serviceWorker).toBe('active');
  });

  it('reports "waiting" when a worker exists but is not serving yet', async () => {
    // `registerType: 'prompt'` parks an update here until the user refreshes —
    // the state the user sees as "the update never arrived".
    withRegistration({ waiting: {} });
    expect((await probeOfflineReadiness()).serviceWorker).toBe('waiting');
  });

  it('reports "waiting" while the first worker is still installing', async () => {
    withRegistration({ installing: {} });
    expect((await probeOfflineReadiness()).serviceWorker).toBe('waiting');
  });

  it('reports "unregistered" when there is no registration', async () => {
    withRegistration(undefined);
    expect((await probeOfflineReadiness()).serviceWorker).toBe('unregistered');
  });

  it('falls back to "unsupported" when getRegistration rejects', async () => {
    defineNavigator('serviceWorker', {
      getRegistration: () => Promise.reject(new Error('site data blocked')),
    });
    expect((await probeOfflineReadiness()).serviceWorker).toBe('unsupported');
  });
});

describe('probeOfflineReadiness — precache entries', () => {
  it('counts only the workbox precache, not the runtime caches', async () => {
    vi.stubGlobal(
      'caches',
      cacheStorageWith({
        'workbox-precache-v2-https://tp.example/': 42,
        'tp-studio-export-vendor-v1': 5,
        'tp-studio-pdf-v1': 1,
      })
    );
    expect((await probeOfflineReadiness()).precachedEntries).toBe(42);
  });

  it('reports 0 when the precache never populated — the smoking gun', async () => {
    vi.stubGlobal('caches', cacheStorageWith({ 'tp-studio-pdf-v1': 1 }));
    expect((await probeOfflineReadiness()).precachedEntries).toBe(0);
  });

  it('reports null (not 0) when Cache Storage itself is unreadable', async () => {
    // A private window can reject `caches.keys()`. "We could not look" must not
    // be reported as "the cache is empty" — they point at different fixes.
    vi.stubGlobal('caches', { keys: () => Promise.reject(new Error('denied')) });
    expect((await probeOfflineReadiness()).precachedEntries).toBeNull();
  });
});

describe('probeOfflineReadiness — storage', () => {
  it('reads persistence and usage when the Storage API is available', async () => {
    defineNavigator('storage', {
      persisted: () => Promise.resolve(true),
      estimate: () => Promise.resolve({ usage: 3 * 1024 * 1024, quota: 1e9 }),
    });
    const readiness = await probeOfflineReadiness();
    expect(readiness.persisted).toBe('yes');
    expect(readiness.usageBytes).toBe(3 * 1024 * 1024);
  });

  it('distinguishes a refused grant from an unsupported browser', async () => {
    defineNavigator('storage', {
      persisted: () => Promise.resolve(false),
      estimate: () => Promise.resolve({}),
    });
    const readiness = await probeOfflineReadiness();
    expect(readiness.persisted).toBe('no');
    expect(readiness.usageBytes).toBeNull();
  });

  it('degrades to unknown when the Storage API rejects', async () => {
    defineNavigator('storage', {
      persisted: () => Promise.reject(new Error('denied')),
      estimate: () => Promise.reject(new Error('denied')),
    });
    const readiness = await probeOfflineReadiness();
    expect(readiness.persisted).toBe('unknown');
    expect(readiness.usageBytes).toBeNull();
  });
});

describe('useOfflineReadiness', () => {
  it('starts unprobed and settles on the probe result', async () => {
    defineNavigator('serviceWorker', { getRegistration: () => Promise.resolve({ active: {} }) });
    vi.stubGlobal('caches', cacheStorageWith({ 'workbox-precache-v2-x': 7 }));

    const { result } = renderHook(() => useOfflineReadiness());
    expect(result.current.probed).toBe(false);

    await waitFor(() => expect(result.current.probed).toBe(true));
    expect(result.current.serviceWorker).toBe('active');
    expect(result.current.precachedEntries).toBe(7);
  });

  it('does not set state after unmount', async () => {
    defineNavigator('serviceWorker', { getRegistration: () => Promise.resolve({ active: {} }) });
    const { result, unmount } = renderHook(() => useOfflineReadiness());
    unmount();
    // Let the probe promises settle against the unmounted component; the
    // cancellation flag is what keeps this from warning.
    await Promise.resolve();
    await Promise.resolve();
    expect(result.current.probed).toBe(false);
  });
});
