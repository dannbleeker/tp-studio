// The warm-up runs at boot on every visit, so the bar is "never throws,
// never wastes a request". These cases pin the skip conditions (offline,
// no service worker, no manifest), the two-tier ordering that keeps ~5 MiB
// of book from delaying the export chunks, and the idle scheduling —
// including the `setTimeout` path browsers without `requestIdleCallback`
// take.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetOfflineWarmupForTest,
  scheduleOfflineWarmup,
  warmOfflineAssets,
} from '@/services/pwa/offlineWarmup';

const MANIFEST = {
  assets: ['assets/jspdf.es.min-abc123.js', 'assets/pptxgen.es-def456.js'],
  deferred: ['Causal-Thinking-with-TP-Studio.pdf'],
};

/** Replace a `navigator` property jsdom either omits or makes read-only. */
function setNavigator(key: string, value: unknown): void {
  Object.defineProperty(navigator, key, { value, configurable: true, writable: true });
}

function okJson(body: unknown): Response {
  return { ok: true, status: 200, json: () => Promise.resolve(body) } as unknown as Response;
}

function ok(): Response {
  return { ok: true, status: 200 } as unknown as Response;
}

/** Serves the manifest, then a 200 for every asset it names. */
function fetchStub(manifest: unknown = MANIFEST) {
  return vi.fn((input: RequestInfo | URL) =>
    Promise.resolve(String(input).endsWith('offline-warmup.json') ? okJson(manifest) : ok())
  );
}

beforeEach(() => {
  __resetOfflineWarmupForTest();
  setNavigator('onLine', true);
  setNavigator('serviceWorker', {});
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  __resetOfflineWarmupForTest();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, 'requestIdleCallback');
  vi.restoreAllMocks();
});

describe('warmOfflineAssets', () => {
  it('fetches the manifest and then every asset it names', async () => {
    const fetchMock = fetchStub();
    vi.stubGlobal('fetch', fetchMock);

    await warmOfflineAssets();
    // The deferred tier is handed to a second idle slot on purpose.
    await vi.runAllTimersAsync();

    const requested = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(requested).toEqual([
      '/offline-warmup.json',
      '/assets/jspdf.es.min-abc123.js',
      '/assets/pptxgen.es-def456.js',
      '/Causal-Thinking-with-TP-Studio.pdf',
    ]);
  });

  it('holds the deferred tier back until a second idle moment', async () => {
    const fetchMock = fetchStub();
    vi.stubGlobal('fetch', fetchMock);

    await warmOfflineAssets();

    // Feature chunks are in; the ~5 MiB book has not started yet.
    const beforeIdle = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(beforeIdle).toHaveLength(3);
    expect(beforeIdle.some((url) => url.endsWith('.pdf'))).toBe(false);

    await vi.runAllTimersAsync();
    expect(fetchMock.mock.calls.some((call) => String(call[0]).endsWith('.pdf'))).toBe(true);
  });

  it('skips everything while the browser reports offline', async () => {
    const fetchMock = fetchStub();
    vi.stubGlobal('fetch', fetchMock);
    setNavigator('onLine', false);

    await warmOfflineAssets();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('skips everything where there is no service worker to warm into', async () => {
    const fetchMock = fetchStub();
    vi.stubGlobal('fetch', fetchMock);
    Reflect.deleteProperty(navigator, 'serviceWorker');

    await warmOfflineAssets();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not throw when the manifest fetch rejects', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('network down')))
    );

    await expect(warmOfflineAssets()).resolves.toBeUndefined();
  });

  it('does not throw when the manifest is missing (404 after a redeploy)', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: false, status: 404 } as unknown as Response)
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(warmOfflineAssets()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('does not throw when an individual asset fetch fails', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) =>
      String(input).endsWith('offline-warmup.json')
        ? Promise.resolve(okJson(MANIFEST))
        : Promise.reject(new Error('chunk gone'))
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(warmOfflineAssets()).resolves.toBeUndefined();
    await vi.runAllTimersAsync();
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
  });

  it('ignores manifest entries that are not strings', async () => {
    const fetchMock = fetchStub({ assets: ['assets/jspdf-1.js', 42, null], deferred: 'nope' });
    vi.stubGlobal('fetch', fetchMock);

    await warmOfflineAssets();
    await vi.runAllTimersAsync();

    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
      '/offline-warmup.json',
      '/assets/jspdf-1.js',
    ]);
  });

  it('runs at most once per page load', async () => {
    const fetchMock = fetchStub();
    vi.stubGlobal('fetch', fetchMock);

    await warmOfflineAssets();
    await vi.runAllTimersAsync();
    const afterFirst = fetchMock.mock.calls.length;

    await warmOfflineAssets();
    expect(fetchMock.mock.calls).toHaveLength(afterFirst);
  });
});

describe('scheduleOfflineWarmup', () => {
  it('defers to requestIdleCallback when the browser has one', () => {
    const ric = vi.fn();
    Object.defineProperty(window, 'requestIdleCallback', {
      value: ric,
      configurable: true,
      writable: true,
    });

    scheduleOfflineWarmup();

    expect(ric).toHaveBeenCalledOnce();
    expect(ric.mock.calls[0]?.[1]).toEqual({ timeout: 10_000 });
  });

  it('falls back to a timeout where requestIdleCallback is absent', async () => {
    // jsdom has no `requestIdleCallback`, which is also Safari < 16.
    expect(window.requestIdleCallback).toBeUndefined();
    const fetchMock = fetchStub();
    vi.stubGlobal('fetch', fetchMock);

    scheduleOfflineWarmup();
    expect(fetchMock).not.toHaveBeenCalled();

    await vi.runAllTimersAsync();
    expect(fetchMock).toHaveBeenCalled();
  });
});
