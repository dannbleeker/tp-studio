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
  // Visual snapshots require a committed baseline `.png` for each
  // platform Playwright runs on. The repo carries Linux baselines under
  // `e2e/visual-canvas.spec.ts-snapshots/` once the manual
  // `Update visual snapshots` workflow has been triggered. The
  // workflow sets `REFRESH_VISUAL_SNAPSHOTS=1` so these tests run
  // (with `--update-snapshots`) in that workflow's run; regular CI
  // runs skip them when the env var is unset to avoid baseline-mismatch
  // flakes pre-refresh.
  test.skip(
    !!process.env.CI && !process.env.REFRESH_VISUAL_SNAPSHOTS,
    'Visual baselines refresh via the `Update visual snapshots` workflow'
  );

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
    await page.mouse.dblclick(cx - 150, cy);
    await page.waitForTimeout(80);
    await page.mouse.dblclick(cx + 150, cy);
    await page.waitForTimeout(80);
    await page.mouse.dblclick(cx, cy + 100);
    // Allow dagre to finish laying out.
    await page.waitForTimeout(200);

    await expect(page.locator('[data-component="tp-node"]')).toHaveCount(3);
    await expect(page).toHaveScreenshot('canvas-three-entities.png', {
      maxDiffPixelRatio: 0.02,
      mask: [page.locator('[data-component="toaster"]')],
    });
  });
});
