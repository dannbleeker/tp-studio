import { expect, test } from '@playwright/test';

/**
 * Visual regression for the canvas render. Catches the kind of
 * regression that jsdom unit tests miss — CSS / layout / React Flow
 * positioning bugs that change the pixel output.
 *
 * On the first run on a CI runner that supports Chromium snapshots,
 * Playwright records the baseline `.png` into `e2e/__snapshots__/`.
 * Subsequent runs compare; mismatches above the configured threshold
 * fail the test and produce a diff image in `test-results/`.
 *
 * Two snapshots:
 *   - **empty canvas** — the initial-load state with no entities.
 *     Catches regressions in the empty-state hint, the TopBar
 *     layout, and the title input.
 *   - **canvas with three entities** — a small auto-laid-out CRT
 *     created via canvas double-clicks. Catches React Flow node
 *     styling, edge stroke colour, and the dagre default layout
 *     direction.
 *
 * `maxDiffPixelRatio` is set permissively (0.02 = 2%) because
 * Chromium versions vary across runners and tiny anti-aliasing
 * differences shouldn't fail the build. Real regressions affect far
 * more pixels.
 */

test.describe('canvas visual regression', () => {
  // Linux baselines committed in
  // `e2e/visual-canvas.spec.ts-snapshots/canvas-{empty,three-entities}-chromium-linux.png`.
  // To refresh them when an intentional visual change lands (theme,
  // typography, node styling), trigger the manual
  // `Update visual snapshots` workflow — it runs Playwright with
  // `--update-snapshots`, pushes the new PNGs to the
  // `chore/update-visual-snapshots` branch, and (once the
  // "Allow GitHub Actions to create / approve pull requests" toggle is
  // enabled in repo settings) opens a PR. Until that toggle is on, the
  // PR step fails but the branch push still succeeds — pull the PNGs
  // manually and commit them on main.

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('empty canvas snapshot', async ({ page }) => {
    await page.goto('/');
    // Wait for the React Flow viewport to mount so the screenshot is
    // stable. The element shows up even on an empty doc.
    await page.waitForSelector('.react-flow__viewport');
    await expect(page).toHaveScreenshot('canvas-empty.png', {
      maxDiffPixelRatio: 0.02,
      // Mask the dynamic toast region so a stale "Loaded example"
      // toast from a previous test doesn't fail comparison.
      mask: [page.locator('[data-component="toaster"]')],
    });
  });

  test('canvas with three entities snapshot', async ({ page }) => {
    await page.goto('/');
    const viewport = page.viewportSize();
    if (!viewport) test.fail();
    const cx = viewport!.width / 2;
    const cy = viewport!.height / 2;
    const nodes = page.locator('[data-component="tp-node"]');

    // Each dblclick is followed by a `toHaveCount` poll for the
    // expected node count, NOT a fixed sleep. Earlier versions used
    // 80-ms `waitForTimeout` waits which flaked on the slower CI
    // runner — the 3rd dblclick sometimes landed before React Flow
    // had reflowed and didn't register, leaving only 2 nodes when
    // the snapshot compared. Polling is self-pacing and the
    // baselines we regenerated continue to apply (visual output is
    // identical once all 3 nodes are committed).
    await page.mouse.dblclick(cx - 150, cy);
    await expect(nodes).toHaveCount(1);
    await page.mouse.dblclick(cx + 150, cy);
    await expect(nodes).toHaveCount(2);
    await page.mouse.dblclick(cx, cy + 100);
    await expect(nodes).toHaveCount(3);
    // Settle dagre + commit any pending position writes before the
    // screenshot is taken.
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('canvas-three-entities.png', {
      maxDiffPixelRatio: 0.02,
      mask: [page.locator('[data-component="toaster"]')],
    });
  });
});
