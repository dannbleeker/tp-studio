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
  // `--update-snapshots`, pushes the new PNGs to
  // `chore/update-visual-snapshots`, and opens a PR with the
  // regenerated baselines. Review the visual diff in the PR before
  // merging; each changed PNG is a rendering difference you're
  // accepting as canonical. When the regenerated baselines are
  // byte-identical to what's on `main`, the action correctly skips PR
  // creation and deletes the stale branch — no spam.

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
    // Session 102 — migrated from a chain of three `page.mouse.dblclick`
    // events to deterministic seeding via the `__TP_TEST__` hook. The
    // original test flaked intermittently on CI Chromium: after the
    // second entity, dagre re-laid-out A+B, and a re-laid-out node
    // sometimes occupied the screen coordinate where the 3rd dblclick
    // was supposed to land. `Canvas.tsx:onDoubleClick` explicitly
    // bails when the target falls inside `.react-flow__node`, so the
    // 3rd entity was silently never created. Result: the count poll
    // exhausted retries with only 2 nodes present.
    //
    // The visual output we want to lock in is "3 entities under
    // dagre auto-layout" — that's exactly what the test hook
    // produces, and it doesn't depend on screen coordinates at all.
    // Baseline regenerated alongside this change.
    await page.goto('/?test=1');
    await page.evaluate(() => {
      const hook = window.__TP_TEST__;
      if (!hook) throw new Error('test hook not installed');
      hook.seed({ titles: ['One', 'Two', 'Three'] });
    });
    const nodes = page.locator('[data-component="tp-node"]');
    await expect(nodes).toHaveCount(3);
    // Settle dagre + commit any pending position writes before the
    // screenshot is taken. The two-frame settle gives the layout
    // hook + React Flow's transition both a chance to finish.
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('canvas-three-entities.png', {
      maxDiffPixelRatio: 0.02,
      mask: [page.locator('[data-component="toaster"]')],
    });
  });
});
