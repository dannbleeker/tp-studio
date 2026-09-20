/**
 * Pull the deliberately-un-precached assets into the service worker's
 * runtime cache once the app has settled.
 *
 * Two groups end up here, for the same reason from opposite directions:
 *
 *   1. **Export / preview vendor chunks.** Sessions 132 / 134 / 135 took
 *      jspdf, html2canvas, svg2pdf, pptxgen and MarkdownPreview out of
 *      the install-time precache because they are ~750 KB raw that most
 *      first-time visitors never touch. The `CacheFirst` runtime route
 *      kept them working offline — but only *after* the user had exported
 *      or previewed once while online. A user who installed the app, went
 *      offline, and then reached for PDF / PNG / PowerPoint export or the
 *      markdown preview got a dead feature.
 *   2. **The practitioner book (PDF + EPUB).** Session 136 precached
 *      these for offline-from-first-launch. They since grew to 5.29 MiB —
 *      89% of a ~6 MiB all-or-nothing install, where one failed request
 *      means the worker never activates and the origin gets no cache at
 *      all. They came back out of the precache; this is where the offline
 *      story they were chasing is now delivered.
 *
 * Both stay out of the install-critical path, and both get fetched on
 * idle, after first paint, when the network is free.
 *
 * Decisions worth keeping:
 *
 *   - **`fetch()`, not `import()`.** We want the bytes in the cache, not
 *     the modules evaluated. A dynamic import would parse and execute
 *     ~750 KB of vendor code on every boot for a feature the user may
 *     never open; a plain fetch hits the same `CacheFirst` route and
 *     stops there.
 *   - **The URL list comes from the build, not from this file.** Vite
 *     content-hashes the chunk filenames, so hard-coding them is
 *     impossible and guessing them is fragile. `vite.config.ts` emits
 *     `offline-warmup.json` at `generateBundle` from the same constant
 *     that feeds `globIgnores` and the runtime-cache regex, so the three
 *     cannot drift apart.
 *   - **The book waits for a second idle moment.** ~5 MiB of documents
 *     must never delay the few hundred KB that make a *feature* work.
 *   - **A user-forced top-up is a different run, not the same one with a
 *     flag.** `topUpOfflineAssets()` bypasses the `completed` latch (a
 *     button wired to the boot path is a silent no-op in every session
 *     where the boot warm-up succeeded) and awaits BOTH tiers, because
 *     someone who pressed a button is asking for the handbook too and is
 *     watching a short wifi window. The boot path keeps the idle hand-off
 *     that protects first paint — and hands the book tier over as a
 *     *claimable* job (`bookTier`) rather than firing it into an idle
 *     callback, so a press landing in that window adopts the download in
 *     progress instead of starting a second copy of the same ~5 MiB.
 */

import { log } from '../logger';
import { runWhenIdle } from './idle';

/** Emitted into `dist/` by the `offline-warmup-manifest` plugin in `vite.config.ts`. */
const MANIFEST_FILE = 'offline-warmup.json';

/**
 * What the on-demand tier looks like in Cache Storage right now.
 *
 * `'counted'` always carries `total > 0` — an empty list resolves to
 * `'empty'` instead — so a reader needs no `total === 0` branch. The four
 * states are kept apart rather than collapsed into a nullable number because
 * "we could not look at the caches", "we could not read the list", "the list
 * is empty" and "we looked and found none" point at four different fixes, and
 * each needs a different sentence on screen. `'listUnavailable'` and
 * `'empty'` were one state once, which made the panel say "this build lists
 * no extras" about a manifest it had simply failed to fetch.
 *
 * `missingBytes` is the download the button in front of the user would start,
 * summed from the build-time sizes in the manifest — `null` when the manifest
 * carries no sizes (an older deploy) or when one of the missing files has no
 * size recorded, because a partial sum shown as a total is exactly the kind of
 * optimistic number this panel exists not to print.
 */
export type OfflineExtrasCount =
  | { status: 'counted'; cached: number; total: number; missingBytes: number | null }
  | { status: 'unreadable' }
  | { status: 'listUnavailable' }
  | { status: 'empty' };

/** Per-file progress, tagged by tier so the UI can name what is downloading. */
export interface OfflineTopUpProgress {
  tier: 'assets' | 'deferred';
  done: number;
  total: number;
}

export type OfflineTopUpOutcome =
  | { status: 'offline' }
  | { status: 'unsupported' }
  | { status: 'uncontrolled' }
  | { status: 'unavailable' }
  | { status: 'ran'; attempted: number; missed: number };

// `completed` latches only a run that actually warmed something. A run that
// bailed for want of a network must NOT latch, or a laptop opened with no wifi
// stays un-warmed for the rest of the session — which is exactly the case this
// whole module exists to serve.
let completed = false;
let listeningForReconnect = false;

// The live run, if any. A promise rather than a boolean so a second caller can
// *adopt* the run instead of being told "busy" and getting nothing: that is
// what makes a double-press safe without relying on a `disabled` attribute.
let inFlight: { promise: Promise<OfflineTopUpOutcome>; forced: boolean } | null = null;

/**
 * The boot run's book tier, recorded from the moment the idle hand-off is
 * QUEUED — not from when it starts.
 *
 * `warmOfflineAssets()` has to resolve before ~5 MiB of handbook begins (that
 * hand-off is the whole point of the tier), so the boot run cannot await it.
 * Firing it straight into `runWhenIdle` left it invisible to everything else,
 * and a forced top-up landing in that window started a *second* concurrent
 * download of the same file: garbled progress for the listener both runs feed,
 * and doubled bytes on a tethered phone. Holding it here as a claimable job
 * means a press either starts it early or adopts the copy already running.
 */
let bookTier: { urls: readonly string[]; run: Promise<number> | null } | null = null;

// Held in module variables so they can actually be removed again. Anonymous
// handlers left the test suite accumulating live listeners across cases, where
// a later `dispatchEvent(new Event('online'))` re-entered the module from a
// previous case's listener.
let onlineHandler: (() => void) | null = null;
let visibilityHandler: (() => void) | null = null;
let controllerHandler: (() => void) | null = null;

const progressListeners = new Set<(progress: OfflineTopUpProgress) => void>();

function notifyProgress(progress: OfflineTopUpProgress): void {
  for (const listener of progressListeners) {
    try {
      listener(progress);
    } catch (err) {
      // A listener that throws is a UI bug; it must not abort the download the
      // user is waiting on.
      log.warn('Offline warm-up: progress listener threw', err);
    }
  }
}

function resolveUrl(pathname: string): string {
  // Manifest entries are build-relative (`assets/jspdf-<hash>.js`), so
  // they must be joined onto Vite's configured base rather than the
  // current document path.
  const base = import.meta.env.BASE_URL || '/';
  return `${base.endsWith('/') ? base : `${base}/`}${pathname.replace(/^\//, '')}`;
}

/**
 * The manifest's optional `sizes` map, or `null` when this build did not emit
 * one. Optional on purpose: a deploy from before sizes existed must still warm
 * and still count, just without a download figure.
 */
function numbersAt(value: unknown, key: string): Record<string, number> | null {
  if (typeof value !== 'object' || value === null || !(key in value)) return null;
  const map = (value as Record<string, unknown>)[key];
  if (typeof map !== 'object' || map === null || Array.isArray(map)) return null;
  const out: Record<string, number> = {};
  for (const [name, size] of Object.entries(map)) {
    if (typeof size === 'number' && Number.isFinite(size) && size >= 0) out[name] = size;
  }
  return out;
}

function stringsAt(value: unknown, key: string): string[] {
  if (typeof value !== 'object' || value === null || !(key in value)) return [];
  const list = (value as Record<string, unknown>)[key];
  if (!Array.isArray(list)) return [];
  return list.filter((entry): entry is string => typeof entry === 'string');
}

/**
 * Fetch the build manifest, or `null` when it cannot be read.
 *
 * Wrapped in an object rather than returned bare because `unknown | null`
 * collapses to `unknown`, which would make "not available" unrepresentable.
 */
async function loadManifest(): Promise<{ data: unknown } | null> {
  try {
    const response = await fetch(resolveUrl(MANIFEST_FILE));
    if (!response.ok) {
      // A redeploy can swap the manifest mid-flight; the network can also drop
      // between the `onLine` check and here. Both are worth another attempt.
      log.info(`Offline warm-up: manifest unavailable (${response.status})`);
      return null;
    }
    return { data: await response.json() };
  } catch (err) {
    log.info('Offline warm-up: manifest fetch failed', err);
    return null;
  }
}

/**
 * Try again when the connection plausibly came back.
 *
 * The scenario is a laptop that opens with no wifi, gets a short window of it,
 * and is closed again — with the tab never reloaded in between. Without this
 * the warm-up only ever runs at boot, so that window is wasted and the next
 * offline stint has no export chunks and no book.
 *
 * Two triggers, because one is not enough:
 *
 *   - `online` fires on the transition, which is the clean case.
 *   - `visibilitychange` covers the case `online` cannot see. `navigator.onLine`
 *     only means "there is a link", so a laptop joined to a wifi with no working
 *     internet already reads as online; when real connectivity arrives, no
 *     `online` event fires at all. Re-opening the lid or coming back to the tab
 *     is the moment the user would expect it to catch up, so that is used as the
 *     second prompt. It costs a `fetch` of a small JSON when there is nothing to
 *     do, and only until a clean run latches.
 */
function listenForReconnect(): void {
  if (listeningForReconnect || typeof window === 'undefined') return;
  listeningForReconnect = true;
  onlineHandler = (): void => {
    void warmOfflineAssets();
  };
  visibilityHandler = (): void => {
    if (document.visibilityState === 'visible') void warmOfflineAssets();
  };
  window.addEventListener('online', onlineHandler);
  document.addEventListener('visibilitychange', visibilityHandler);
  // The moment a worker takes over this page is the moment warming can succeed
  // at all — and on a first load it is the ONLY trigger that will ever fire,
  // because the network never dropped and the tab never hid.
  // Probed rather than assumed: `serviceWorker` can be present without the full
  // EventTarget surface in restricted embeddings, and an exception here would
  // take down the retry path that the caller is relying on.
  if (
    'serviceWorker' in navigator &&
    typeof navigator.serviceWorker?.addEventListener === 'function'
  ) {
    controllerHandler = (): void => {
      void warmOfflineAssets();
    };
    navigator.serviceWorker.addEventListener('controllerchange', controllerHandler);
  }
}

/**
 * Did the bytes actually land in Cache Storage? Never throws — a browser that
 * withholds `caches` reports "no", which costs a retry rather than a false
 * success.
 */
async function isCached(url: string): Promise<boolean> {
  if (typeof caches === 'undefined') return false;
  try {
    return (await caches.match(url, { ignoreSearch: true })) !== undefined;
  } catch {
    return false;
  }
}

/** Fetch each URL in order. Returns how many failed. Never throws. */
async function warmTier(
  label: string,
  urls: readonly string[],
  tier: OfflineTopUpProgress['tier']
): Promise<number> {
  if (urls.length === 0) return 0;
  // Sequential on purpose: this is background work competing with the
  // user's own requests, and parallel multi-MB downloads on a slow
  // connection would be felt.
  let warmed = 0;
  for (const [index, url] of urls.entries()) {
    try {
      const resolved = resolveUrl(url);
      const response = await fetch(resolved);
      if (!response.ok) {
        log.warn(`Offline warm-up: ${url} returned ${response.status}`);
      } else if (await isCached(resolved)) {
        warmed += 1;
      } else {
        // `response.ok` is NOT proof of caching, and treating it as such has
        // caused three separate defects here: a runtime-cache route whose
        // stringified closure threw so nothing ever matched, and a warm-up
        // running on a page no worker controlled. Both reported a clean sweep
        // while Cache Storage stayed empty. The only honest success signal is
        // reading the cache back, so that is what counts.
        log.warn(`Offline warm-up: ${url} fetched but did not reach Cache Storage`);
      }
    } catch (err) {
      // A redeploy between manifest and asset fetch, or the network
      // dropping mid-warm-up. Neither is worth failing the boot over.
      log.warn(`Offline warm-up: ${url} failed`, err);
    }
    // Reported after the request settles either way: a watcher wants to see the
    // counter move past a file that failed, not stall on it.
    notifyProgress({ tier, done: index + 1, total: urls.length });
  }
  log.info(`Offline warm-up: cached ${warmed}/${urls.length} ${label}`);
  return urls.length - warmed;
}

/**
 * Take over the boot run's book tier: start it now when the idle slot has not
 * fired yet, adopt the live download when it has. `null` means there is
 * nothing outstanding and the caller must run the tier itself.
 *
 * Clearing `bookTier` once the run settles is deliberate: a later press is a
 * legitimate re-verify, and re-fetching is nearly free because the
 * `CacheFirst` route serves whatever already landed. What must never happen is
 * two downloads of the same file at once, which is what the claim prevents.
 */
function claimBookTier(): Promise<number> | null {
  const tier = bookTier;
  if (!tier) return null;
  tier.run ??= warmTier('deferred documents', tier.urls, 'deferred').finally(() => {
    if (bookTier === tier) bookTier = null;
  });
  return tier.run;
}

/**
 * The one body both entry points share. `forced` changes exactly two things:
 * it is reached past the `completed` latch, and it awaits the book tier inline
 * instead of handing it to a second idle slot.
 */
async function run(forced: boolean): Promise<OfflineTopUpOutcome> {
  // No network to warm *from*. Deliberately does not latch `completed`: this is
  // a "not yet", not a "never", and the reconnect listener is what turns a short
  // wifi window into a topped-up cache.
  if (navigator.onLine === false) {
    listenForReconnect();
    log.info('Offline warm-up: no network yet — will retry when the connection returns');
    return { status: 'offline' };
  }
  // Nowhere to warm *into*. This one really is permanent, so it latches.
  if (!('serviceWorker' in navigator)) {
    completed = true;
    log.info('Offline warm-up: skipped, no service worker support');
    return { status: 'unsupported' };
  }

  // A worker that EXISTS is not a worker that is SERVING THIS PAGE. With
  // `registerType: 'prompt'` there is no `clientsClaim`, so a first load — and
  // every load on a profile that clears site data on exit — installs the worker
  // without it ever controlling that document. Fetches then bypass the worker,
  // the runtime-cache routes never run, and nothing is stored: measured at
  // 6.36 MiB downloaded and discarded, with every response reading `ok`.
  // Treated like the offline case — a "not yet", never latched.
  if (!navigator.serviceWorker.controller) {
    listenForReconnect();
    log.info('Offline warm-up: no worker is serving this page yet — deferred');
    return { status: 'uncontrolled' };
  }

  const manifest = await loadManifest();
  if (manifest === null) {
    listenForReconnect();
    return { status: 'unavailable' };
  }

  const assets = stringsAt(manifest.data, 'assets');
  const deferred = stringsAt(manifest.data, 'deferred');

  let missed = await warmTier('on-demand chunks', assets, 'assets');
  let attempted = assets.length;

  if (deferred.length > 0) {
    if (forced) {
      // Someone pressed a button and is watching a short wifi window. Resolving
      // before ~5 MiB of handbook had even started would report "done" while the
      // one thing they were waiting for was still queued. `claimBookTier()`
      // first, so a boot download already under way is adopted rather than
      // duplicated.
      missed += await (claimBookTier() ?? warmTier('deferred documents', deferred, 'deferred'));
      attempted += deferred.length;
    } else {
      // Yield back to the browser before the heavy tier. The chunks above
      // unlock features; the book is ~5 MiB of reading material, and it has
      // no business sharing a slice with them.
      bookTier = { urls: deferred, run: null };
      runWhenIdle(() => {
        const book = claimBookTier();
        // `null` means a forced top-up got here first and already ran it.
        if (!book) return;
        void book.then((missedBook) => {
          if (missedBook === 0) return;
          // The network can vanish mid-book. Arm the retry rather than leaving
          // the reader half-cached with no second chance — and re-open the
          // latch the assets tier may already have closed, because
          // `warmOfflineAssets()` returns immediately while `completed` is
          // true, which made this retry unreachable for the book specifically.
          completed = false;
          listenForReconnect();
        });
      });
    }
  }

  // Only a clean sweep latches. A partial one — the connection dropped
  // mid-warm-up, which is the norm on a brief wifi window — must be allowed
  // to finish itself when the network returns. Re-running is cheap: the
  // `CacheFirst` route serves whatever already landed.
  if (missed === 0) {
    completed = true;
  } else {
    // Re-opening the latch, not merely leaving it alone: a *later* run can find
    // it already closed by an earlier clean one, and an armed reconnect that
    // `warmOfflineAssets()` refuses to act on is worse than no retry at all,
    // because it looks like a retry.
    completed = false;
    listenForReconnect();
  }

  return { status: 'ran', attempted, missed };
}

/**
 * Register the run BEFORE its first await, so there is no window in which two
 * callers each see "nothing in flight" and start their own.
 *
 * `after` lets a forced run queue behind a boot run that is already going
 * without leaving that gap: the wait happens inside the promise this call has
 * already published as `inFlight`.
 */
function start(forced: boolean, after?: Promise<unknown>): Promise<OfflineTopUpOutcome> {
  const promise = (async () => {
    // `run()` does not throw, but a caller-supplied promise is not ours to
    // trust, and a rejection here must not turn into an unhandled one.
    if (after) await after.catch(() => undefined);
    return run(forced);
  })().finally(() => {
    // Only if it is still ours: a forced run can replace a boot run's entry
    // while that boot run is still settling.
    if (inFlight?.promise === promise) inFlight = null;
  });
  inFlight = { promise, forced };
  return promise;
}

/**
 * Fetch everything the build manifest names so the runtime cache holds
 * it. Idempotent and never throws — a missing manifest (dev build, or a
 * redeploy that swapped the hashes mid-session) is a no-op.
 */
export async function warmOfflineAssets(): Promise<void> {
  if (completed || inFlight) return;
  await start(false);
}

/**
 * A user-forced top-up: run now, whatever the boot path already did, and
 * report what happened.
 *
 * Deliberately does NOT consult `completed` — that latch is why a button wired
 * straight to `warmOfflineAssets()` does nothing in the (usual) session where
 * the boot warm-up succeeded.
 */
export async function topUpOfflineAssets(
  onProgress?: (progress: OfflineTopUpProgress) => void
): Promise<OfflineTopUpOutcome> {
  if (onProgress) progressListeners.add(onProgress);
  try {
    // A forced run already in flight IS this press's run — adopt it, never
    // fetch twice. A dialog reopened mid-run therefore picks up the live
    // progress instead of starting a second download.
    if (inFlight?.forced) return await inFlight.promise;
    // A boot warm-up in flight does not await the book, so we queue our own
    // forced pass behind it — INSIDE `start`, which publishes `inFlight`
    // synchronously. Awaiting the boot run out here first and then calling
    // `start` left a gap in which two presses both saw no forced run and both
    // started one; re-running is cheap, but running twice at once is not.
    return await start(true, inFlight?.promise);
  } finally {
    if (onProgress) progressListeners.delete(onProgress);
  }
}

/**
 * How much of the on-demand tier would resolve with no network.
 *
 * Counts Cache Storage, never fetch results: `vite.config.ts` records a real
 * failure where a broken `urlPattern` cached nothing while every response still
 * read `ok`, because the throw fell through to the network.
 *
 * Uses the cross-cache `caches.match` rather than opening
 * `tp-studio-export-vendor-v1` / `tp-studio-pdf-v1` by name, for three reasons:
 * it answers the question actually being asked ("will this URL resolve
 * offline"); the vendor cache carries `maxEntries: 20`, i.e. up to four
 * deploys of stale content-hashed names, so its key count over-reports and
 * cannot identify *this* build's chunks; and naming the caches here would add
 * a fourth place that has to agree about the on-demand list, which
 * `vite.config.ts` exists to prevent. A precache hit counting as cached is
 * correct rather than a bug — it resolves offline either way.
 *
 * Works with no network: `offline-warmup.json` is precached on purpose, so
 * "am I ready for the flight?" is answerable on the plane.
 *
 * KNOWN LIMITATION, stated rather than hidden: both runtime routes carry
 * workbox's `ExpirationPlugin` with a 30-day `maxAgeSeconds`, and that plugin
 * evicts lazily — on the next request, not on the clock. So an entry older
 * than the cap is still in Cache Storage and still answers `caches.match`,
 * while the worker would refuse to serve it and go to the network instead.
 * This row can therefore over-report by counting a file that is present but
 * stale. Reading the cap would mean either repeating it here (the drift
 * `vite.config.ts` is built to prevent — three places already have to agree
 * about this list) or threading it through the manifest and the PWA route
 * config together, which is a change to the caching config rather than to this
 * panel. The exposure is bounded: the boot warm-up re-fetches the whole tier on
 * every visit with a network, and a request for an entry past the cap is
 * exactly when workbox drops it and re-caches a fresh copy — so the over-report
 * self-corrects on the next online boot, and only misleads someone who has been
 * offline for longer than the cap.
 */
export async function countCachedOfflineExtras(): Promise<OfflineExtrasCount> {
  if (typeof caches === 'undefined') return { status: 'unreadable' };
  const manifest = await loadManifest();
  if (manifest === null) return { status: 'listUnavailable' };
  const urls = [...stringsAt(manifest.data, 'assets'), ...stringsAt(manifest.data, 'deferred')];
  if (urls.length === 0) return { status: 'empty' };
  const sizes = numbersAt(manifest.data, 'sizes');
  try {
    let cached = 0;
    // `null` from the first unmeasurable file onwards: an under-count printed
    // as "about N MB to download" is worse than printing no number at all,
    // because the number is what the user budgets a two-minute window against.
    let missingBytes: number | null = sizes === null ? null : 0;
    for (const url of urls) {
      if (await caches.match(resolveUrl(url))) {
        cached += 1;
        continue;
      }
      const size = sizes?.[url];
      missingBytes = missingBytes === null || size === undefined ? null : missingBytes + size;
    }
    return { status: 'counted', cached, total: urls.length, missingBytes };
  } catch {
    // A private window or a locked-down managed profile can expose `caches` and
    // then reject the read. "We could not look" is not "nothing is cached".
    return { status: 'unreadable' };
  }
}

/** Run the warm-up once the browser reports an idle moment. */
export function scheduleOfflineWarmup(): void {
  runWhenIdle(() => {
    void warmOfflineAssets();
  });
}

/** Test-only: clear the run-once guards so each case starts cold. */
export function __resetOfflineWarmupForTest(): void {
  if (typeof window !== 'undefined') {
    if (onlineHandler) window.removeEventListener('online', onlineHandler);
    if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);
    if (controllerHandler && typeof navigator.serviceWorker?.removeEventListener === 'function') {
      navigator.serviceWorker.removeEventListener('controllerchange', controllerHandler);
    }
  }
  onlineHandler = null;
  visibilityHandler = null;
  controllerHandler = null;
  completed = false;
  inFlight = null;
  bookTier = null;
  listeningForReconnect = false;
  progressListeners.clear();
}
