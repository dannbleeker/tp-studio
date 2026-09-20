import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';

/**
 * Offline regression coverage for the PWA.
 *
 * TP Studio is local-first and ships as an installable PWA, so "works with the
 * network unplugged" is a product promise, not a nice-to-have. Two ways it had
 * silently broken with nothing to catch it:
 *
 *   1. The **app shell** did not come back on reload — the user got the
 *      browser's own "No internet access" page, which reads as "the app is
 *      broken" rather than "the network is gone".
 *   2. Individual **lazy chunks** were excluded from the install-time precache
 *      for cold-start reasons (the PDF/PNG/PPTX export vendors, the markdown
 *      preview) and were then unreachable offline — export died mid-click.
 *
 * The chunk assertion below is deliberately written against the **emitted
 * build output** rather than a hardcoded list: every `dist/assets/*.js` file
 * must resolve while offline. Adding a new `globIgnores` entry without also
 * warming that chunk turns this spec red, which is the whole point.
 *
 * No screenshots — this must pass on any platform, not just the Linux runner
 * that owns the `visual-*` baselines.
 */

const ASSETS_DIR = fileURLToPath(new URL('../dist/assets', import.meta.url));

/** Every JS chunk the build emitted, as same-origin URLs the page can fetch. */
async function emittedChunkUrls(): Promise<string[]> {
  const entries = await readdir(ASSETS_DIR).catch(() => {
    throw new Error(
      `Could not read ${ASSETS_DIR}. The offline spec asserts against real build output — run the build before the e2e suite.`
    );
  });
  return entries.filter((name) => name.endsWith('.js')).map((name) => `/assets/${name}`);
}

/**
 * Resolve once a service worker is not merely registered but *controlling* the
 * page. `registerType: 'prompt'` means no `clientsClaim`, so the first load
 * installs the worker and a reload is what hands it the page — exactly what a
 * returning user experiences, and the only state in which offline works.
 */
async function waitForControllingServiceWorker(page: Page): Promise<void> {
  await page.waitForFunction(
    async () => {
      if (!('serviceWorker' in navigator)) return false;
      const registration = await navigator.serviceWorker.getRegistration();
      return registration?.active != null;
    },
    undefined,
    { timeout: 60_000 }
  );
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, {
    timeout: 60_000,
  });
}

/** Names of the emitted chunks that are not yet in any Cache Storage bucket. */
async function uncachedChunks(page: Page, urls: string[]): Promise<string[]> {
  return page.evaluate(async (candidates) => {
    const missing: string[] = [];
    for (const url of candidates) {
      // `caches.match` searches every cache, so this covers the workbox
      // precache AND the runtime caches the idle warm-up populates — the spec
      // asserts the OUTCOME (reachable offline), not the mechanism.
      const hit = await caches.match(url, { ignoreSearch: true });
      if (!hit) missing.push(url);
    }
    return missing;
  }, urls);
}

test.describe('offline', () => {
  test('the shell and every emitted chunk survive losing the network', async ({
    page,
    context,
  }) => {
    const chunks = await emittedChunkUrls();
    // A build that emitted no chunks would make every assertion below vacuous.
    expect(chunks.length).toBeGreaterThan(0);

    await page.goto('/?test=1');
    await page.evaluate(() => localStorage.clear());
    await waitForControllingServiceWorker(page);

    // The warm-up runs on an idle callback, so poll for its OUTCOME instead of
    // sleeping a guessed number of milliseconds — a bare sleep would be either
    // flaky on a loaded CI runner or needlessly slow.
    await expect
      .poll(() => uncachedChunks(page, chunks), {
        timeout: 60_000,
        message: 'chunks still missing from Cache Storage while online',
      })
      .toEqual([]);

    await context.setOffline(true);

    // 1. The shell still renders after a reload with no network. Assert on a
    //    real control, not a status code — the failure mode was the browser's
    //    error page replacing the app entirely.
    await page.reload();
    await expect(page.getByRole('button', { name: /search or run a command/i })).toBeVisible();

    // 2. And the user is told it is the network, not the app.
    const indicator = page.locator('[data-component="offline-indicator"]');
    await expect(indicator).toContainText(/offline/i);

    // 3. Every emitted chunk actually resolves offline. This is the assertion
    //    that locks the regression: a newly precache-excluded chunk that
    //    nothing warms fails here.
    const failures = await page.evaluate(async (candidates) => {
      const bad: string[] = [];
      for (const url of candidates) {
        try {
          const res = await fetch(url);
          if (!res.ok) bad.push(`${url} → HTTP ${res.status}`);
        } catch (error) {
          bad.push(`${url} → ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      return bad;
    }, chunks);
    expect(failures, 'chunks that failed to load offline').toEqual([]);
  });

  test('the offline indicator clears when the network comes back', async ({ page, context }) => {
    await page.goto('/?test=1');
    const indicator = page.locator('[data-component="offline-indicator"]');
    await expect(indicator).toBeAttached();
    await expect(indicator).not.toContainText(/offline/i);

    await context.setOffline(true);
    await expect(indicator).toContainText(/offline/i);

    await context.setOffline(false);
    await expect(indicator).not.toContainText(/offline/i);
  });
});
