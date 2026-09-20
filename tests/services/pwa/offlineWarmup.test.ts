// The warm-up runs at boot on every visit, so the bar is "never throws,
// never wastes a request". These cases pin the skip conditions (offline,
// no service worker, no manifest), the two-tier ordering that keeps ~5 MiB
// of book from delaying the export chunks, and the idle scheduling —
// including the `setTimeout` path browsers without `requestIdleCallback`
// take.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetOfflineWarmupForTest,
  countCachedOfflineExtras,
  type OfflineTopUpProgress,
  scheduleOfflineWarmup,
  topUpOfflineAssets,
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

/** How many times the ~5 MiB handbook was requested. */
function bookCalls(fetchMock: { mock: { calls: unknown[][] } }): number {
  return fetchMock.mock.calls.filter((call) => String(call[0]).endsWith('.pdf')).length;
}

/** A promise plus the handle that settles it, for pinning a download in flight. */
function gate() {
  let open = (): void => {};
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { opened, open: () => open() };
}

beforeEach(() => {
  __resetOfflineWarmupForTest();
  setNavigator('onLine', true);
  // A controller, because that is the state in which warming can actually work.
  // The uncontrolled case is its own describe block below — it was a real,
  // measured bug and needs to be asked for explicitly, never be the default.
  setNavigator('serviceWorker', {
    controller: {},
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  });
  // jsdom has no Cache Storage, and the warm-up now counts a file as warmed only
  // when it can read it back — so without this the default harness would model a
  // browser that stores nothing, and every "runs once" assertion would see the
  // (correct) retry behaviour instead. A cache that reports a hit is the normal
  // case; the miss is asserted explicitly below.
  vi.stubGlobal('caches', { match: async () => ({}) as unknown as Response });
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

describe('warmOfflineAssets — a short window of wifi', () => {
  // The scenario these pin: a laptop opened with no wifi, given a brief
  // connection, and closed again without the tab ever being reloaded. An
  // earlier version latched its run-once flag *before* the offline check, so
  // that window was silently wasted and the next offline stint had no export
  // chunks and no book.
  it('tops up when the connection returns, without a reload', async () => {
    const fetchMock = fetchStub();
    vi.stubGlobal('fetch', fetchMock);
    setNavigator('onLine', false);

    await warmOfflineAssets();
    expect(fetchMock, 'nothing is fetched while offline').not.toHaveBeenCalled();

    setNavigator('onLine', true);
    window.dispatchEvent(new Event('online'));
    // The listener kicks off an async run; the suite uses fake timers, so flush
    // the microtask queue rather than waiting on wall-clock.
    await vi.advanceTimersByTimeAsync(10);

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('offline-warmup.json'));
    for (const asset of MANIFEST.assets) {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining(asset));
    }
  });

  it('does not re-warm once a clean run has happened', async () => {
    const fetchMock = fetchStub();
    vi.stubGlobal('fetch', fetchMock);

    await warmOfflineAssets();
    const afterFirst = fetchMock.mock.calls.length;

    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(10);
    expect(fetchMock.mock.calls.length).toBe(afterFirst);
  });

  it('retries the BOOK on reconnect after its own tier failed', async () => {
    // The boot run latches `completed` on the assets tier alone, so the retry
    // the failing book tier armed used to be unreachable: `warmOfflineAssets()`
    // returned before doing anything and the handbook stayed missing for the
    // rest of the session. The reconnect fix has to reach the book too.
    let bookAttempts = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('offline-warmup.json')) return Promise.resolve(okJson(MANIFEST));
      if (url.endsWith('.pdf')) {
        bookAttempts += 1;
        return bookAttempts === 1
          ? Promise.reject(new Error('network lost'))
          : Promise.resolve(ok());
      }
      return Promise.resolve(ok());
    });
    vi.stubGlobal('fetch', fetchMock);

    await warmOfflineAssets();
    await vi.runAllTimersAsync();
    expect(bookAttempts, 'the book tier ran once and failed').toBe(1);

    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(10);
    await vi.runAllTimersAsync();

    expect(bookAttempts).toBe(2);
  });

  it('finishes the job when the connection drops mid-warm-up', async () => {
    // One asset fails, so the run is partial — it must not latch, and the
    // reconnect must pick up the remainder.
    let failNext = true;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input).endsWith('offline-warmup.json')) return Promise.resolve(okJson(MANIFEST));
      if (failNext) {
        failNext = false;
        return Promise.reject(new Error('network lost'));
      }
      return Promise.resolve(ok());
    });
    vi.stubGlobal('fetch', fetchMock);

    await warmOfflineAssets();
    const afterPartial = fetchMock.mock.calls.length;

    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(10);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(afterPartial);
  });
});

describe('topUpOfflineAssets — the user pressed a button', () => {
  // The whole reason this entry point exists: `warmOfflineAssets` latches
  // `completed` on a clean run, so a button wired straight to it does nothing
  // in every session where the boot warm-up succeeded — invisible unless you
  // happen to be watching the Network panel.
  it('runs even after a clean warm-up latched the run-once flag', async () => {
    const fetchMock = fetchStub();
    vi.stubGlobal('fetch', fetchMock);

    await warmOfflineAssets();
    await vi.runAllTimersAsync();
    fetchMock.mockClear();

    await topUpOfflineAssets();

    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
      '/offline-warmup.json',
      '/assets/jspdf.es.min-abc123.js',
      '/assets/pptxgen.es-def456.js',
      '/Causal-Thinking-with-TP-Studio.pdf',
    ]);
  });

  it('fetches the book before it resolves, with no idle hop', async () => {
    const fetchMock = fetchStub();
    vi.stubGlobal('fetch', fetchMock);

    // Deliberately no `runAllTimersAsync()`: a press during a two-minute wifi
    // window must not be told "done" while ~5 MiB is still queued.
    await topUpOfflineAssets();

    expect(fetchMock.mock.calls.some((call) => String(call[0]).endsWith('.pdf'))).toBe(true);
  });

  it('adopts a run already in flight instead of fetching twice', async () => {
    const fetchMock = fetchStub();
    vi.stubGlobal('fetch', fetchMock);

    const [first, second] = await Promise.all([topUpOfflineAssets(), topUpOfflineAssets()]);

    const manifestCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).endsWith('offline-warmup.json')
    );
    expect(manifestCalls).toHaveLength(1);
    expect(first).toEqual(second);
  });

  it('adopts the boot run book download instead of starting a second copy', async () => {
    // The expensive one: ~5 MiB of handbook fetched twice at once, both
    // reporting into the same progress listener. On a tether that is money.
    const book = gate();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('offline-warmup.json')) return okJson(MANIFEST);
      if (url.endsWith('.pdf')) await book.opened;
      return ok();
    });
    vi.stubGlobal('fetch', fetchMock);

    await warmOfflineAssets();
    // The idle hand-off fires: the book is now downloading, and stuck on the gate.
    await vi.advanceTimersByTimeAsync(3_000);
    expect(bookCalls(fetchMock)).toBe(1);

    const press = topUpOfflineAssets();
    await vi.advanceTimersByTimeAsync(10);
    book.open();
    await press;

    expect(bookCalls(fetchMock)).toBe(1);
  });

  it('starts the queued book tier early rather than letting idle run it again', async () => {
    // The other order: the press lands BEFORE the idle slot fires. The tier has
    // to be taken over, not left to run a second time once idle arrives.
    const fetchMock = fetchStub();
    vi.stubGlobal('fetch', fetchMock);

    await warmOfflineAssets();
    expect(bookCalls(fetchMock), 'the idle hand-off has not fired yet').toBe(0);

    await topUpOfflineAssets();
    expect(bookCalls(fetchMock)).toBe(1);

    await vi.runAllTimersAsync();
    expect(bookCalls(fetchMock)).toBe(1);
  });

  it('keeps two presses landing on a boot run down to one forced run', async () => {
    // Both used to await the boot run and then both call `start(true)`: two
    // forced runs, two of everything. Adopting has to be decided with no await
    // between the check and the start.
    const fetchMock = fetchStub();
    vi.stubGlobal('fetch', fetchMock);

    const boot = warmOfflineAssets();
    const [first, second] = await Promise.all([topUpOfflineAssets(), topUpOfflineAssets()]);
    await boot;
    await vi.runAllTimersAsync();

    const manifestCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).endsWith('offline-warmup.json')
    );
    expect(manifestCalls, 'one for the boot run, one for the single forced run').toHaveLength(2);
    expect(bookCalls(fetchMock)).toBe(1);
    expect(first).toBe(second);
  });

  it('reports "offline" without fetching when the browser has no network', async () => {
    const fetchMock = fetchStub();
    vi.stubGlobal('fetch', fetchMock);
    setNavigator('onLine', false);

    expect(await topUpOfflineAssets()).toEqual({ status: 'offline' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports "unsupported" where there is no service worker to warm into', async () => {
    vi.stubGlobal('fetch', fetchStub());
    Reflect.deleteProperty(navigator, 'serviceWorker');

    expect(await topUpOfflineAssets()).toEqual({ status: 'unsupported' });
  });

  it('reports "unavailable" when the manifest 404s mid-redeploy', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 404 } as unknown as Response))
    );

    expect(await topUpOfflineAssets()).toEqual({ status: 'unavailable' });
  });

  it('counts what it missed rather than pretending a partial run succeeded', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('offline-warmup.json')) return Promise.resolve(okJson(MANIFEST));
      if (url.endsWith('jspdf.es.min-abc123.js')) {
        return Promise.resolve({ ok: false, status: 404 } as unknown as Response);
      }
      return Promise.resolve(ok());
    });
    vi.stubGlobal('fetch', fetchMock);

    expect(await topUpOfflineAssets()).toEqual({ status: 'ran', attempted: 3, missed: 1 });
  });

  it('reports progress per file, tagged by tier', async () => {
    vi.stubGlobal('fetch', fetchStub());
    const seen: OfflineTopUpProgress[] = [];

    await topUpOfflineAssets((progress) => seen.push(progress));

    expect(seen).toEqual([
      { tier: 'assets', done: 1, total: 2 },
      { tier: 'assets', done: 2, total: 2 },
      { tier: 'deferred', done: 1, total: 1 },
    ]);
  });
});

describe('__resetOfflineWarmupForTest', () => {
  it('detaches the reconnect listeners it armed', async () => {
    vi.stubGlobal('fetch', fetchStub());
    setNavigator('onLine', false);
    await warmOfflineAssets();

    // Without removal the anonymous handlers survived the reset, so a later
    // case's `online` event re-entered the module from this one's listener.
    __resetOfflineWarmupForTest();
    const fetchMock = fetchStub();
    vi.stubGlobal('fetch', fetchMock);
    setNavigator('onLine', true);
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(10);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('countCachedOfflineExtras', () => {
  /** Cache Storage that resolves `match` for exactly the URLs given. */
  const cachesMatching = (urls: readonly string[]) => {
    const present = new Set(urls);
    return {
      match: (request: RequestInfo | URL) =>
        Promise.resolve(present.has(String(request)) ? ({} as Response) : undefined),
    };
  };

  it('reports "unreadable" rather than zero when Cache Storage is absent', async () => {
    // The locked-down-profile case: "we could not look" must never be reported
    // as "nothing is cached". The shared harness stubs a working `caches`, so
    // this case has to take it away again deliberately.
    vi.stubGlobal('caches', undefined);
    vi.stubGlobal('fetch', fetchStub());
    expect(await countCachedOfflineExtras()).toEqual({ status: 'unreadable' });
  });

  it('counts the manifest URLs that would resolve with no network', async () => {
    vi.stubGlobal('fetch', fetchStub());
    vi.stubGlobal(
      'caches',
      cachesMatching(['/assets/jspdf.es.min-abc123.js', '/Causal-Thinking-with-TP-Studio.pdf'])
    );

    expect(await countCachedOfflineExtras()).toEqual({
      status: 'counted',
      cached: 2,
      total: 3,
      // This manifest carries no `sizes`: an older deploy must still count.
      missingBytes: null,
    });
  });

  it('adds up what the missing files would cost, from the build-time sizes', async () => {
    vi.stubGlobal(
      'fetch',
      fetchStub({
        ...MANIFEST,
        sizes: {
          'assets/jspdf.es.min-abc123.js': 100,
          'assets/pptxgen.es-def456.js': 200,
          'Causal-Thinking-with-TP-Studio.pdf': 5_000,
        },
      })
    );
    vi.stubGlobal('caches', cachesMatching(['/assets/jspdf.es.min-abc123.js']));

    expect(await countCachedOfflineExtras()).toEqual({
      status: 'counted',
      cached: 1,
      total: 3,
      missingBytes: 5_200,
    });
  });

  it('refuses a partial total when a missing file has no recorded size', async () => {
    // Half a sum printed as "about 0.2 MB to download" is worse than no figure:
    // the number is what a two-minute window gets budgeted against.
    vi.stubGlobal(
      'fetch',
      fetchStub({ ...MANIFEST, sizes: { 'assets/jspdf.es.min-abc123.js': 100 } })
    );
    vi.stubGlobal('caches', cachesMatching([]));

    expect(await countCachedOfflineExtras()).toMatchObject({ cached: 0, missingBytes: null });
  });

  it('reports "listUnavailable" when the list itself cannot be read', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 404 } as unknown as Response))
    );
    vi.stubGlobal('caches', cachesMatching([]));

    expect(await countCachedOfflineExtras()).toEqual({ status: 'listUnavailable' });
  });

  it('separates a list that is empty from one that could not be read', async () => {
    // One state for both said "this build lists no extras" about a manifest the
    // app had merely failed to fetch — a statement about the build that was not
    // true, in the likelier of the two cases.
    vi.stubGlobal('fetch', fetchStub({ assets: [], deferred: [] }));
    vi.stubGlobal('caches', cachesMatching([]));

    expect(await countCachedOfflineExtras()).toEqual({ status: 'empty' });
  });

  it('reports "unreadable" when the cache read rejects', async () => {
    vi.stubGlobal('fetch', fetchStub());
    vi.stubGlobal('caches', { match: () => Promise.reject(new Error('site data blocked')) });

    expect(await countCachedOfflineExtras()).toEqual({ status: 'unreadable' });
  });
});

describe('warmOfflineAssets — a worker that exists but is not serving this page', () => {
  // The defect these pin, measured against the real build: on a first load
  // `registerType: 'prompt'` installs a worker that never claims the document,
  // so every fetch bypassed it and 6.36 MiB was downloaded into nothing — while
  // each response read `ok`, so the run logged a clean sweep and latched.
  // Every other offline test in this repo reloads until the page is controlled
  // before asserting, which is exactly why none of them could see this.
  it('fetches nothing at all when no worker controls the page', async () => {
    const fetchMock = fetchStub();
    vi.stubGlobal('fetch', fetchMock);
    setNavigator('serviceWorker', { controller: null, addEventListener: () => undefined });

    await warmOfflineAssets();

    expect(fetchMock, 'not one byte may be spent with nowhere to put it').not.toHaveBeenCalled();
  });

  it('warms as soon as a worker takes over the page', async () => {
    const fetchMock = fetchStub();
    vi.stubGlobal('fetch', fetchMock);
    // Collected into an array rather than a `let`: a variable only ever assigned
    // inside a callback narrows to `never` at the call site.
    const controllerListeners: Array<() => void> = [];
    setNavigator('serviceWorker', {
      controller: null,
      addEventListener: (type: string, handler: () => void) => {
        if (type === 'controllerchange') controllerListeners.push(handler);
      },
      removeEventListener: () => undefined,
    });

    await warmOfflineAssets();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(controllerListeners, 'a controllerchange retry must be armed').toHaveLength(1);

    // The worker claims the page — on a first load this is the ONLY trigger that
    // ever fires, since the network never dropped and the tab never hid.
    setNavigator('serviceWorker', {
      controller: {},
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    });
    controllerListeners[0]?.();
    await vi.advanceTimersByTimeAsync(10);

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('offline-warmup.json'));
  });

  it('does not count a fetch that never reached Cache Storage', async () => {
    // The premise behind three separate defects now: `response.ok` means the
    // server answered, not that anything was stored. A cache that reports a miss
    // for everything must leave the run un-latched so a retry can still happen.
    const fetchMock = fetchStub();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('caches', { match: async () => undefined });

    await warmOfflineAssets();
    const afterFirst = fetchMock.mock.calls.length;
    expect(afterFirst).toBeGreaterThan(0);

    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(10);

    expect(
      fetchMock.mock.calls.length,
      'a run that cached nothing must not latch as complete'
    ).toBeGreaterThan(afterFirst);
  });
});
