import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OfflineReadinessSection } from '@/components/about/OfflineReadinessSection';
import { en } from '@/i18n/locales/en';
import { __resetOfflineWarmupForTest } from '@/services/pwa/offlineWarmup';

/**
 * The About dialog's diagnostics rows. The point of these tests is that the
 * section renders a readable answer in BOTH directions — a healthy install and
 * the "nothing is cached" install that produced the reported failure — because
 * a blank row tells a support conversation nothing.
 */

const defineNavigator = (key: string, value: unknown) => {
  Object.defineProperty(window.navigator, key, { configurable: true, value });
};

const MANIFEST = {
  assets: ['assets/jspdf-abc.js', 'assets/pptxgen-def.js'],
  deferred: ['Causal-Thinking-with-TP-Studio.pdf'],
};

const ALL_URLS = [
  '/assets/jspdf-abc.js',
  '/assets/pptxgen-def.js',
  '/Causal-Thinking-with-TP-Studio.pdf',
];

/** Build-time transfer sizes, as the manifest now carries them. */
const SIZES = {
  'assets/jspdf-abc.js': 150,
  'assets/pptxgen-def.js': 150,
  'Causal-Thinking-with-TP-Studio.pdf': 5 * 1024 * 1024,
};

/** Two deferred files, so the book tier itself reports progress mid-tier. */
const TWO_BOOKS = {
  assets: MANIFEST.assets,
  deferred: ['Causal-Thinking-with-TP-Studio.pdf', 'Causal-Thinking-with-TP-Studio.epub'],
};

const TWO_BOOK_URLS = [...ALL_URLS, '/Causal-Thinking-with-TP-Studio.epub'];

/** A promise plus the handle that settles it, for pinning a download in flight. */
function gate() {
  let open = (): void => {};
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { opened, open: () => open() };
}

// One button in this section, and its label has two forms — query by role
// rather than by name so a test never pins the wording it is not about.
const topUpButton = () => screen.getByRole('button') as HTMLButtonElement;

const pressIsBlocked = () => topUpButton().getAttribute('aria-disabled') === 'true';

/** The visually-hidden live region the button is described by. */
const announced = (container: HTMLElement) =>
  container.querySelector('[role="status"]')?.textContent ?? '';

/** The line a sighted reader sees, which carries the per-file counts. */
const visibleStatus = (container: HTMLElement) => container.querySelector('p')?.textContent ?? '';

const activeWorker = () =>
  defineNavigator('serviceWorker', { getRegistration: () => Promise.resolve({ active: {} }) });

/** Serves the build manifest, then a 200 for everything it names. */
const manifestFetch = (manifest: unknown = MANIFEST) =>
  vi.fn((input: RequestInfo | URL) =>
    Promise.resolve(
      String(input).endsWith('offline-warmup.json')
        ? ({ ok: true, status: 200, json: () => Promise.resolve(manifest) } as unknown as Response)
        : ({ ok: true, status: 200 } as unknown as Response)
    )
  );

/** Cache Storage whose hits follow a list the test can mutate mid-run. */
const cachesMatching = (present: { urls: readonly string[] }) => ({
  match: (request: RequestInfo | URL) =>
    Promise.resolve(present.urls.includes(String(request)) ? ({} as Response) : undefined),
});

beforeEach(() => {
  __resetOfflineWarmupForTest();
  defineNavigator('onLine', true);
  // Default to a network that answers nothing, so a case that does not care
  // about the extras count never reaches for the real one.
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('no network in tests')))
  );
});

afterEach(() => {
  cleanup();
  __resetOfflineWarmupForTest();
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
    expect(text).toContain(en.about.offline.extras);
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

/**
 * The extras row and its control. Three rules carry these cases: the number
 * always comes from Cache Storage rather than from what a fetch returned;
 * without an ACTIVE worker there is no number to show at all — the manifest
 * would then come from the network and name a different deploy's hashes; and
 * a press that cannot happen always says why, in a place a keyboard can reach.
 */
describe('OfflineReadinessSection — offline extras', () => {
  it('reports a partial count against the live worker', async () => {
    activeWorker();
    vi.stubGlobal('fetch', manifestFetch());
    vi.stubGlobal('caches', cachesMatching({ urls: ALL_URLS.slice(0, 2) }));

    const { container } = render(<OfflineReadinessSection />);

    await waitFor(() =>
      expect(container.textContent).toContain(en.about.offline.extrasSome({ cached: 2, total: 3 }))
    );
  });

  it('refuses to show a number while no worker is serving — the hash-mismatch trap', async () => {
    // `registerType: 'prompt'` parks a fresh install here. Fetches bypass the
    // worker, so the manifest names the NEXT deploy's content hashes and every
    // cache lookup misses; "none cached" would be a lie about assets this page
    // will never request.
    defineNavigator('serviceWorker', { getRegistration: () => Promise.resolve({ waiting: {} }) });
    vi.stubGlobal('fetch', manifestFetch());
    vi.stubGlobal('caches', cachesMatching({ urls: [] }));

    const { container } = render(<OfflineReadinessSection />);

    await waitFor(() => expect(container.textContent).toContain(en.about.offline.extrasNoWorker));
    expect(pressIsBlocked()).toBe(true);
    expect(container.textContent).toContain(en.about.offline.topUpNeedsWorker);
  });

  it('gives a browser with no service-worker API its own answer', async () => {
    // Nothing to refresh into here, ever. "Refresh to finish installing, then
    // top up" was advice that could not work, under a row that had already
    // said the API is missing.
    vi.stubGlobal('fetch', manifestFetch());
    vi.stubGlobal('caches', cachesMatching({ urls: [] }));

    const { container } = render(<OfflineReadinessSection />);

    await waitFor(() =>
      expect(container.textContent).toContain(en.about.offline.extrasNoSwSupport)
    );
    expect(container.textContent).toContain(en.about.offline.topUpNoWorkerSupport);
    expect(container.textContent).not.toContain(en.about.offline.topUpNeedsWorker);
    expect(pressIsBlocked()).toBe(true);
  });

  it('carries a reason through the probe window too', () => {
    // First paint, before any probe lands: blocked, and an empty line beside a
    // blocked control is the one thing this panel's own rule forbids.
    const { container } = render(<OfflineReadinessSection />);

    expect(pressIsBlocked()).toBe(true);
    expect(announced(container)).toBe(en.about.offline.checking);
  });

  it('explains the blocked button while the browser is offline', async () => {
    activeWorker();
    defineNavigator('onLine', false);
    vi.stubGlobal('fetch', manifestFetch());
    vi.stubGlobal('caches', cachesMatching({ urls: [] }));

    const { container } = render(<OfflineReadinessSection />);

    await waitFor(() =>
      expect(container.textContent).toContain(en.about.offline.topUpNeedsNetwork)
    );
    expect(pressIsBlocked()).toBe(true);
  });

  it('keeps the reason reachable: never the native disabled attribute', async () => {
    // A natively `disabled` button leaves the tab order and its
    // `aria-describedby` goes unread — so the explanation was unreachable in
    // exactly the states it was written for.
    activeWorker();
    defineNavigator('onLine', false);
    vi.stubGlobal('fetch', manifestFetch());
    vi.stubGlobal('caches', cachesMatching({ urls: [] }));

    render(<OfflineReadinessSection />);
    await waitFor(() => expect(pressIsBlocked()).toBe(true));

    expect(topUpButton().disabled).toBe(false);
    topUpButton().focus();
    expect(document.activeElement).toBe(topUpButton());
    const describedBy = topUpButton().getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(describedBy)?.textContent).toBe(
      en.about.offline.topUpNeedsNetwork
    );
  });

  it('ignores a press while blocked', async () => {
    activeWorker();
    defineNavigator('onLine', false);
    const fetchMock = manifestFetch();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('caches', cachesMatching({ urls: [] }));

    render(<OfflineReadinessSection />);
    await waitFor(() => expect(pressIsBlocked()).toBe(true));

    fireEvent.click(topUpButton());
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('.pdf'));
  });

  it('names the size of the pending download before it is pressed', async () => {
    // The one number that decides whether to spend a two-minute wifi window,
    // and it has to come from the build: a HEAD per file would spend the
    // metered bytes it exists to protect.
    activeWorker();
    vi.stubGlobal('fetch', manifestFetch({ ...MANIFEST, sizes: SIZES }));
    vi.stubGlobal('caches', cachesMatching({ urls: [] }));

    const { container } = render(<OfflineReadinessSection />);

    await waitFor(() =>
      expect(container.textContent).toContain(en.about.offline.topUpSize({ mb: '5.0' }))
    );
    expect(topUpButton().textContent).toContain(en.about.offline.topUpDownload);
  });

  it('tops up on press and re-reads the row from Cache Storage', async () => {
    activeWorker();
    const fetchMock = manifestFetch();
    vi.stubGlobal('fetch', fetchMock);
    const present = { urls: [] as readonly string[] };
    vi.stubGlobal('caches', cachesMatching(present));

    const { container } = render(<OfflineReadinessSection />);
    await waitFor(() =>
      expect(container.textContent).toContain(en.about.offline.extrasNo({ total: 3 }))
    );

    // The worker is what would populate the cache in a browser; here the stub
    // stands in for it, which is also the point — the row reports the cache,
    // not the fetch results.
    present.urls = ALL_URLS;
    fireEvent.click(topUpButton());

    await waitFor(() =>
      expect(container.textContent).toContain(en.about.offline.extrasYes({ total: 3 }))
    );
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('.pdf'));
    expect(container.textContent).toContain(en.about.offline.topUpDone);
    // Nothing left to fetch, so the press is now a re-check, and the label
    // says that rather than describing a download that will not happen.
    expect(topUpButton().textContent).toContain(en.about.offline.topUpRecheck);
  });

  it('announces the tier, not every file, while a download runs', async () => {
    // A polite live region re-announces on every change, so per-file counts
    // interrupted the reader once per file. The counts stay on screen; the
    // announcement moves only when the tier does.
    activeWorker();
    const book = gate();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('offline-warmup.json')) {
          return { ok: true, status: 200, json: () => Promise.resolve(TWO_BOOKS) } as Response;
        }
        if (url.endsWith('.epub')) await book.opened;
        return { ok: true, status: 200 } as Response;
      })
    );
    const present = { urls: [] as readonly string[] };
    vi.stubGlobal('caches', cachesMatching(present));

    const { container } = render(<OfflineReadinessSection />);
    await waitFor(() =>
      expect(container.textContent).toContain(en.about.offline.extrasNo({ total: 4 }))
    );

    fireEvent.click(topUpButton());

    await waitFor(() =>
      expect(visibleStatus(container)).toBe(en.about.offline.topUpBook({ done: 1, total: 2 }))
    );
    expect(announced(container)).toBe(en.about.offline.topUpBookTier);

    present.urls = TWO_BOOK_URLS;
    book.open();
    await waitFor(() => expect(announced(container)).toBe(en.about.offline.topUpDone));
  });

  it('says a build with no extras has none, in the row AND in the line', async () => {
    activeWorker();
    vi.stubGlobal('fetch', manifestFetch({ assets: [], deferred: [] }));
    vi.stubGlobal('caches', cachesMatching({ urls: [] }));

    const { container } = render(<OfflineReadinessSection />);

    await waitFor(() => expect(container.textContent).toContain(en.about.offline.extrasNone));
    // "Done — everything is cached" under "None — this build has no extras"
    // was two answers to one question.
    expect(announced(container)).toBe(en.about.offline.topUpNothingToGet);
    expect(container.textContent).not.toContain(en.about.offline.topUpDone);
    expect(pressIsBlocked()).toBe(true);
  });

  it('separates a list it could not read from a build with nothing to list', async () => {
    activeWorker();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 404 } as unknown as Response))
    );
    vi.stubGlobal('caches', cachesMatching({ urls: [] }));

    const { container } = render(<OfflineReadinessSection />);

    await waitFor(() =>
      expect(container.textContent).toContain(en.about.offline.extrasListUnavailable)
    );
    expect(container.textContent).not.toContain(en.about.offline.extrasNone);
  });

  it('describes the button by the live region, so a screen reader hears the reason', () => {
    const { container } = render(<OfflineReadinessSection />);

    const describedBy = topUpButton().getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const status = [...container.querySelectorAll('[role="status"]')].find(
      (node) => node.id === describedBy
    );
    expect(status).toBeDefined();
  });

  it('replaces a finished result with the blocking reason when the network drops', async () => {
    // The precedence rule, tested as a TRANSITION: a stale "Done" surviving a
    // later offline flip is how this panel would start lying quietly.
    activeWorker();
    vi.stubGlobal('fetch', manifestFetch());
    const present = { urls: ALL_URLS as readonly string[] };
    vi.stubGlobal('caches', cachesMatching(present));

    const { container } = render(<OfflineReadinessSection />);
    await waitFor(() =>
      expect(container.textContent).toContain(en.about.offline.extrasYes({ total: 3 }))
    );
    fireEvent.click(topUpButton());
    await waitFor(() => expect(container.textContent).toContain(en.about.offline.topUpDone));

    defineNavigator('onLine', false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(container.textContent).not.toContain(en.about.offline.topUpDone);
    expect(container.textContent).toContain(en.about.offline.topUpNeedsNetwork);
  });
});
