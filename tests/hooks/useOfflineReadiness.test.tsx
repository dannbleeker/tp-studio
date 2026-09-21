import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
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
  // `controller` is what decides whether the worker serves THIS document, so
  // the stub carries it separately from the registration — the two really can
  // disagree, and that disagreement is the defect the next test pins.
  const withRegistration = (registration: unknown, controller: unknown = {}) =>
    defineNavigator('serviceWorker', {
      getRegistration: () => Promise.resolve(registration),
      controller,
    });

  it('reports "active" when a worker is serving', async () => {
    withRegistration({ active: {} });
    expect((await probeOfflineReadiness()).serviceWorker).toBe('active');
  });

  // An ACTIVE registration is not a worker serving this page. `registerType:
  // 'prompt'` means no `clientsClaim`, so a first load — and every load on a
  // profile that clears site data on exit — activates a worker that never
  // controls the document it installed from. Reporting "Active" there enabled
  // "Download now" and quoted a size for a press that could not cache a byte,
  // while `offlineWarmup` was independently refusing to run for exactly this
  // reason. The panel and the warm-up must agree.
  it('reports "waiting" when the worker is active but controls nothing', async () => {
    withRegistration({ active: {} }, null);
    expect((await probeOfflineReadiness()).serviceWorker).toBe('waiting');
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
    defineNavigator('serviceWorker', {
      getRegistration: () => Promise.resolve({ active: {} }),
      controller: {},
    });
    vi.stubGlobal('caches', cacheStorageWith({ 'workbox-precache-v2-x': 7 }));

    const { result } = renderHook(() => useOfflineReadiness());
    expect(result.current.probed).toBe(false);

    await waitFor(() => expect(result.current.probed).toBe(true));
    expect(result.current.serviceWorker).toBe('active');
    expect(result.current.precachedEntries).toBe(7);
  });

  it('looks again until the worker activates, then stops looking', async () => {
    // A first visit opens this panel before the worker has activated. Probing
    // once at mount meant the panel — and the control it gates — described a
    // state that stopped being true a second later, for the whole time the
    // dialog stayed open.
    let registration: unknown = { waiting: {} };
    let controller: unknown = null;
    let probes = 0;
    defineNavigator('serviceWorker', {
      getRegistration: () => {
        probes += 1;
        return Promise.resolve(registration);
      },
      // A getter, so flipping `controller` below is visible to the next probe
      // the same way a real handover would be.
      get controller() {
        return controller;
      },
    });
    vi.stubGlobal('caches', cacheStorageWith({ 'workbox-precache-v2-x': 7 }));
    vi.useFakeTimers();

    try {
      const { result } = renderHook(() => useOfflineReadiness());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(result.current.serviceWorker).toBe('waiting');

      registration = { active: {} };
      controller = {};
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3_000);
      });
      expect(result.current.serviceWorker).toBe('active');

      // Nothing left to wait for: the re-probe stops rather than spinning for
      // as long as the dialog is open.
      const settled = probes;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });
      expect(probes).toBe(settled);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not re-probe a browser that has no service worker API', async () => {
    // jsdom ships none, which is also older Safari and an insecure origin.
    // No amount of waiting makes the API appear, so waiting would be a spin.
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useOfflineReadiness());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(result.current.serviceWorker).toBe('unsupported');
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
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
