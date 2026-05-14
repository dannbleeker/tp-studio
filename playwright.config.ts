import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright smoke tests run the production build against a real Chromium
 * browser, catching the cracks that jsdom and @testing-library can miss:
 * React Flow's drag-to-connect, the auto-layout pipeline rendering, native
 * `<dialog>` modal focus traps, and the browser file picker flow (well,
 * the pieces of it that don't require a real OS dialog).
 *
 * Vitest stays the inner loop for unit-level coverage; Playwright is the
 * smoke gate before main.
 */
export default defineConfig({
  testDir: './e2e',
  // Sensible defaults — each project run gets its own browser context, so
  // tests don't share state. The dev server starts once via webServer.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: 'http://localhost:4173',
    // Capture trace + screenshot + video on the first failure so CI's
    // uploaded `playwright-report/` artifact has enough evidence to
    // debug a flake without re-running. Local dev keeps the lean
    // defaults (retain only on retry) so the `test-results/` dir
    // doesn't bloat between watch cycles.
    trace: process.env.CI ? 'retain-on-failure' : 'on-first-retry',
    screenshot: 'only-on-failure',
    video: process.env.CI ? 'retain-on-failure' : 'on-first-retry',
  },

  // Only Chromium for now — adding Firefox/WebKit is cheap once a real
  // suite exists. Smoke tests on one engine catch the regressions that
  // matter.
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  // `vite preview` serves the built dist/. Playwright waits for the URL
  // to respond before starting tests. Local devs can run `pnpm dev` in
  // another terminal — webServer.reuseExistingServer picks that up.
  webServer: {
    command: 'pnpm preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
