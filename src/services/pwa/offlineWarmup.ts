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
 */

import { log } from '../logger';
import { runWhenIdle } from './idle';

/** Emitted into `dist/` by the `offline-warmup-manifest` plugin in `vite.config.ts`. */
const MANIFEST_FILE = 'offline-warmup.json';

let started = false;

function resolveUrl(pathname: string): string {
  // Manifest entries are build-relative (`assets/jspdf-<hash>.js`), so
  // they must be joined onto Vite's configured base rather than the
  // current document path.
  const base = import.meta.env.BASE_URL || '/';
  return `${base.endsWith('/') ? base : `${base}/`}${pathname.replace(/^\//, '')}`;
}

function stringsAt(value: unknown, key: string): string[] {
  if (typeof value !== 'object' || value === null || !(key in value)) return [];
  const list = (value as Record<string, unknown>)[key];
  if (!Array.isArray(list)) return [];
  return list.filter((entry): entry is string => typeof entry === 'string');
}

/** Fetch each URL in order, counting successes. Never throws. */
async function warmTier(label: string, urls: readonly string[]): Promise<void> {
  if (urls.length === 0) return;
  // Sequential on purpose: this is background work competing with the
  // user's own requests, and parallel multi-MB downloads on a slow
  // connection would be felt.
  let warmed = 0;
  for (const url of urls) {
    try {
      const response = await fetch(resolveUrl(url));
      if (response.ok) warmed += 1;
      else log.warn(`Offline warm-up: ${url} returned ${response.status}`);
    } catch (err) {
      // A redeploy between manifest and asset fetch, or the network
      // dropping mid-warm-up. Neither is worth failing the boot over.
      log.warn(`Offline warm-up: ${url} failed`, err);
    }
  }
  log.info(`Offline warm-up: cached ${warmed}/${urls.length} ${label}`);
}

/**
 * Fetch everything the build manifest names so the runtime cache holds
 * it. Idempotent and never throws — a missing manifest (dev build, or a
 * redeploy that swapped the hashes mid-session) is a no-op.
 */
export async function warmOfflineAssets(): Promise<void> {
  if (started) return;
  started = true;

  // Nothing to warm *from* with no network, and nowhere to warm *into*
  // without a service worker. In both cases the fetches would be pure
  // waste, so bail before spending them.
  if (navigator.onLine === false) {
    log.info('Offline warm-up: skipped, browser reports offline');
    return;
  }
  if (!('serviceWorker' in navigator)) {
    log.info('Offline warm-up: skipped, no service worker support');
    return;
  }

  let manifest: unknown;
  try {
    const response = await fetch(resolveUrl(MANIFEST_FILE));
    if (!response.ok) {
      log.info(`Offline warm-up: manifest unavailable (${response.status})`);
      return;
    }
    manifest = await response.json();
  } catch (err) {
    log.info('Offline warm-up: manifest fetch failed', err);
    return;
  }

  await warmTier('on-demand chunks', stringsAt(manifest, 'assets'));

  const deferred = stringsAt(manifest, 'deferred');
  if (deferred.length === 0) return;
  // Yield back to the browser before the heavy tier. The chunks above
  // unlock features; the book is ~5 MiB of reading material, and it has
  // no business sharing a slice with them.
  runWhenIdle(() => {
    void warmTier('deferred documents', deferred);
  });
}

/** Run the warm-up once the browser reports an idle moment. */
export function scheduleOfflineWarmup(): void {
  runWhenIdle(() => {
    void warmOfflineAssets();
  });
}

/** Test-only: clear the run-once guard so each case starts cold. */
export function __resetOfflineWarmupForTest(): void {
  started = false;
}
