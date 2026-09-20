import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type TopUpPhase, useOfflineExtras } from '@/hooks/useOfflineExtras';
import { __resetOfflineWarmupForTest } from '@/services/pwa/offlineWarmup';

/**
 * The extras half of the About dialog's offline panel: how much of the
 * on-demand tier is cached, and the one control that changes the answer.
 *
 * The cases that matter are the honest-reporting ones. "We could not look" must
 * never render as a zero, and the terminal phase must be derived from a fresh
 * Cache Storage read rather than from what the fetches returned — a response
 * that read `ok` has historically meant nothing about what the worker kept.
 */

const MANIFEST = {
  assets: ['assets/jspdf-abc.js', 'assets/pptxgen-def.js'],
  deferred: ['Causal-Thinking-with-TP-Studio.pdf'],
};

const ALL_URLS = [
  '/assets/jspdf-abc.js',
  '/assets/pptxgen-def.js',
  '/Causal-Thinking-with-TP-Studio.pdf',
];

function okJson(body: unknown): Response {
  return { ok: true, status: 200, json: () => Promise.resolve(body) } as unknown as Response;
}

function ok(): Response {
  return { ok: true, status: 200 } as unknown as Response;
}

/** Cache Storage that resolves `match` for exactly the URLs given. */
function cachesMatching(urls: readonly string[]) {
  const present = new Set(urls);
  return {
    match: (request: RequestInfo | URL) =>
      Promise.resolve(present.has(String(request)) ? ({} as Response) : undefined),
  };
}

/** A promise plus the handle that settles it, for pinning an in-flight phase. */
function gate() {
  let open = (): void => {};
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { opened, open: () => open() };
}

beforeEach(() => {
  __resetOfflineWarmupForTest();
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true });
  Object.defineProperty(navigator, 'serviceWorker', {
    value: {},
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  cleanup();
  __resetOfflineWarmupForTest();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'serviceWorker');
});

describe('useOfflineExtras — the mount count', () => {
  it('counts the manifest URLs that would resolve with no network', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(okJson(MANIFEST)))
    );
    vi.stubGlobal('caches', cachesMatching(ALL_URLS.slice(0, 2)));

    const { result } = renderHook(() => useOfflineExtras());

    await waitFor(() => expect(result.current.extras.phase).toBe('counted'));
    // No `sizes` in this manifest — an older deploy still counts, without a figure.
    expect(result.current.extras).toEqual({
      phase: 'counted',
      cached: 2,
      total: 3,
      missingBytes: null,
    });
  });

  it('reports "unreadable" rather than a zero where Cache Storage is absent', async () => {
    // jsdom ships no `caches`, which is also the locked-down managed profile.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(okJson(MANIFEST)))
    );

    const { result } = renderHook(() => useOfflineExtras());

    await waitFor(() => expect(result.current.extras).toEqual({ phase: 'unreadable' }));
  });
});

describe('useOfflineExtras — runTopUp', () => {
  it('walks preparing → running → done and re-reads the count afterwards', async () => {
    const book = gate();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('offline-warmup.json')) return okJson(MANIFEST);
        if (url.endsWith('.pdf')) await book.opened;
        return ok();
      })
    );
    // Nothing cached at mount; everything cached by the time the count re-runs.
    let present: readonly string[] = [];
    vi.stubGlobal('caches', {
      match: (request: RequestInfo | URL) =>
        Promise.resolve(present.includes(String(request)) ? ({} as Response) : undefined),
    });

    const seen: TopUpPhase[] = [];
    const { result } = renderHook(() => {
      const value = useOfflineExtras();
      seen.push(value.topUp);
      return value;
    });
    await waitFor(() => expect(result.current.extras.phase).toBe('counted'));

    act(() => result.current.runTopUp());
    expect(result.current.topUp).toEqual({ kind: 'preparing' });

    // Both chunks are through and the book is still downloading.
    await waitFor(() =>
      expect(result.current.topUp).toEqual({ kind: 'running', tier: 'assets', done: 2, total: 2 })
    );

    present = ALL_URLS;
    book.open();

    await waitFor(() => expect(result.current.topUp).toEqual({ kind: 'done' }));
    expect(result.current.extras).toEqual({
      phase: 'counted',
      cached: 3,
      total: 3,
      missingBytes: null,
    });
    expect(seen.map((phase) => phase.kind)).toContain('preparing');
  });

  it('reports "nothing" when the connection answered the manifest and nothing else', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) =>
        String(input).endsWith('offline-warmup.json')
          ? Promise.resolve(okJson(MANIFEST))
          : Promise.reject(new Error('network lost'))
      )
    );
    vi.stubGlobal('caches', cachesMatching([]));

    const { result } = renderHook(() => useOfflineExtras());
    await waitFor(() => expect(result.current.extras.phase).toBe('counted'));

    act(() => result.current.runTopUp());

    await waitFor(() => expect(result.current.topUp).toEqual({ kind: 'nothing' }));
  });

  it('takes the partial numbers from the re-count, not from what the fetches returned', async () => {
    // Two of three requests succeed, but only one actually landed in a cache —
    // the exact gap a broken runtime route produced once, where every response
    // read `ok` while nothing was kept.
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('offline-warmup.json')) return Promise.resolve(okJson(MANIFEST));
        if (url.endsWith('.pdf')) return Promise.reject(new Error('network lost'));
        return Promise.resolve(ok());
      })
    );
    vi.stubGlobal('caches', cachesMatching([ALL_URLS[0] ?? '']));

    const { result } = renderHook(() => useOfflineExtras());
    await waitFor(() => expect(result.current.extras.phase).toBe('counted'));

    act(() => result.current.runTopUp());

    await waitFor(() => expect(result.current.topUp).toEqual({ kind: 'incomplete' }));
    // The numbers live in the row, once, and come from the same read.
    expect(result.current.extras).toMatchObject({ phase: 'counted', cached: 1, total: 3 });
  });

  it('cannot report a partial run over a row that says everything is cached', async () => {
    // The reported contradiction, reproduced: one request fails, so the fetch
    // tally says "partly", while Cache Storage holds all three. The row prints
    // the cache, so the verdict has to come from the cache too — otherwise the
    // panel reads "Partly done — 3 of 3" directly under "Yes — all 3 cached".
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('offline-warmup.json')) return Promise.resolve(okJson(MANIFEST));
        if (url.endsWith('.pdf')) return Promise.reject(new Error('network lost'));
        return Promise.resolve(ok());
      })
    );
    vi.stubGlobal('caches', cachesMatching(ALL_URLS));

    const { result } = renderHook(() => useOfflineExtras());
    await waitFor(() => expect(result.current.extras.phase).toBe('counted'));

    act(() => result.current.runTopUp());

    await waitFor(() => expect(result.current.topUp).toEqual({ kind: 'done' }));
    expect(result.current.extras).toMatchObject({ cached: 3, total: 3 });
  });

  it('says so rather than claiming success when the cache cannot be re-read', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) =>
        Promise.resolve(String(input).endsWith('offline-warmup.json') ? okJson(MANIFEST) : ok())
      )
    );
    // Present at mount, unreadable afterwards — a profile that revokes site
    // data access mid-session. Every fetch said `ok`, which proves nothing.
    let readable = true;
    vi.stubGlobal('caches', {
      match: (request: RequestInfo | URL) =>
        readable
          ? Promise.resolve(ALL_URLS.includes(String(request)) ? ({} as Response) : undefined)
          : Promise.reject(new Error('site data blocked')),
    });

    const { result } = renderHook(() => useOfflineExtras());
    await waitFor(() => expect(result.current.extras.phase).toBe('counted'));

    readable = false;
    act(() => result.current.runTopUp());

    await waitFor(() => expect(result.current.topUp).toEqual({ kind: 'unverified' }));
    expect(result.current.extras).toEqual({ phase: 'unreadable' });
  });

  it('reaches a terminal phase when the count throws, instead of sticking on "preparing"', async () => {
    // A `caches` accessor that throws on READ is a real locked-down-profile
    // shape, and the rejection used to leave the phase at `preparing` — which
    // disables the button for the rest of the dialog's life.
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) =>
        Promise.resolve(String(input).endsWith('offline-warmup.json') ? okJson(MANIFEST) : ok())
      )
    );
    Object.defineProperty(globalThis, 'caches', {
      configurable: true,
      get() {
        throw new Error('site data blocked');
      },
    });

    try {
      const { result } = renderHook(() => useOfflineExtras());
      await waitFor(() => expect(result.current.extras).toEqual({ phase: 'unreadable' }));

      act(() => result.current.runTopUp());

      await waitFor(() => expect(result.current.topUp).toEqual({ kind: 'failed' }));
    } finally {
      Reflect.deleteProperty(globalThis, 'caches');
    }
  });

  it('reports a build with no extras as such, not as a finished download', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(okJson({ assets: [], deferred: [] })))
    );
    vi.stubGlobal('caches', cachesMatching([]));

    const { result } = renderHook(() => useOfflineExtras());
    await waitFor(() => expect(result.current.extras).toEqual({ phase: 'empty' }));

    act(() => result.current.runTopUp());

    // Not `done`: "Done — nothing left to download" under a row reading
    // "None — this build has no extras" is two answers to one question.
    await waitFor(() => expect(result.current.topUp).toEqual({ kind: 'idle' }));
  });

  it('does not set state after unmount', async () => {
    const book = gate();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('offline-warmup.json')) return okJson(MANIFEST);
        if (url.endsWith('.pdf')) await book.opened;
        return ok();
      })
    );
    vi.stubGlobal('caches', cachesMatching([]));

    const { result, unmount } = renderHook(() => useOfflineExtras());
    await waitFor(() => expect(result.current.extras.phase).toBe('counted'));
    act(() => result.current.runTopUp());

    unmount();
    // The download deliberately is NOT aborted — throwing away a short wifi
    // window is worse than an orphaned promise — so the guard is what keeps
    // the completion from writing to a dead component.
    book.open();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.topUp).toEqual({ kind: 'preparing' });
  });
});
