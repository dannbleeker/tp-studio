import { expect, test } from '@playwright/test';

/**
 * The live dashboard (`/dashboard.html`) is a standalone static page — NOT part
 * of the React app. It pulls live repo data from the GitHub API and renders the
 * CI metrics from the same-origin `stats.json`. These tests prove it LOADS in a
 * real browser and fills its metrics.
 *
 * Hermetic by design: the external GitHub API and the Chart.js CDN are stubbed,
 * so the suite never depends on network reachability or GitHub rate limits in
 * CI. Charts are decorative (the script guards `window.Chart`); the metrics we
 * assert on come from `stats.json`, which `vite preview` serves same-origin.
 */
test.describe('Live dashboard (dashboard.html)', () => {
  test.beforeEach(async ({ page }) => {
    // Stub every GitHub API call with an empty array — drives the live loader
    // down its no-data path deterministically without throwing or hitting the
    // network. Abort the Chart.js CDN so `window.load` fires fast and the page
    // doesn't depend on jsdelivr being reachable.
    await page.route('**/api.github.com/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
    await page.route('**/cdn.jsdelivr.net/**', (route) => route.abort());
  });

  test('loads and fills the CI metrics from stats.json without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto('/dashboard.html');
    await expect(page).toHaveTitle(/TP Studio/i);

    // The stats.json-driven section reveals itself; the "pending" banner hides.
    await expect(page.locator('#stats-body')).toBeVisible();
    await expect(page.locator('#stats-pending')).toBeHidden();

    // Headline metrics fill with real values, not the "…" placeholder.
    for (const id of ['#m-lines', '#m-tests', '#m-cov', '#m-files']) {
      await expect(page.locator(id)).not.toHaveText('…');
    }
    await expect(page.locator('#m-lines')).toHaveText(/\d/);
    await expect(page.locator('#m-cov')).toHaveText(/%/);

    // The CI-metrics tables/bars actually rendered rows from the JSON.
    await expect(page.locator('#code-rows tr').first()).toBeVisible();
    await expect(page.locator('#cov-bars .cov-row').first()).toBeVisible();

    // The page wired itself up without throwing.
    expect(errors).toEqual([]);
  });

  test('renders the live repo-pulse scaffold and section headings', async ({ page }) => {
    await page.goto('/dashboard.html');
    await expect(page.getByRole('heading', { name: /TP Studio.*Live Dashboard/i })).toBeVisible();
    // Scope to the section-title chips — both phrases also appear in the footer.
    await expect(page.locator('.section-title', { hasText: 'Repo pulse' })).toBeVisible();
    await expect(page.locator('.section-title', { hasText: 'Project metrics' })).toBeVisible();
    // The repo-pulse headline stats exist (their values come from the live API,
    // stubbed empty here — so we assert presence, not a specific number).
    await expect(page.locator('#s-age')).toBeAttached();
    await expect(page.locator('#s-30d')).toBeAttached();
  });
});
