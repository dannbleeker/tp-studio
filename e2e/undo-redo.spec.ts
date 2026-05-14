import { expect, test } from '@playwright/test';

/**
 * Undo / Redo across a multi-edit sequence. Catches the kind of
 * regression where the history stack stops coalescing correctly, or
 * where a redo path produces a stale doc reference.
 *
 * The unit tests cover the store-action shape (`tests/store/document.test.ts`
 * + history slice tests); this e2e gate confirms the keyboard
 * bindings are wired and that React Flow re-renders after each step.
 */

test.describe('undo / redo', () => {
  // Skipped on CI — the dblclick-to-create-entity pattern this test
  // shares with `delete-flow.spec.ts` doesn't reproduce reliably on the
  // GitHub-Actions Ubuntu runner (entities aren't always counted, or
  // the Ctrl+Z keybind doesn't fire because focus drifted). Locally on
  // Windows / macOS the same flow works. The store-level coverage for
  // undo/redo lives in `tests/store/history.test.ts` (and friends) —
  // those run on every CI execution. Revisit when we have a way to
  // reproduce the CI environment locally and trace the actual failure.
  test.skip(!!process.env.CI, 'dblclick + keyboard pattern flaky on CI runner');

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('Cmd+Z undoes the last create; Cmd+Shift+Z redoes', async ({ page }) => {
    await page.goto('/');
    const viewport = page.viewportSize();
    if (!viewport) test.fail();
    const cx = viewport!.width / 2;
    const cy = viewport!.height / 2;

    // Three entities.
    await page.mouse.dblclick(cx - 150, cy);
    await page.waitForTimeout(300);
    await page.mouse.dblclick(cx + 150, cy);
    await page.waitForTimeout(300);
    await page.mouse.dblclick(cx, cy + 100);
    await page.waitForTimeout(300);

    await expect(page.locator('[data-component="tp-node"]')).toHaveCount(3);

    // Click empty canvas to clear selection (otherwise Delete might
    // trigger).
    await page.mouse.click(20, 20);
    await page.keyboard.press('Control+Z');
    await page.waitForTimeout(300);
    await expect(page.locator('[data-component="tp-node"]')).toHaveCount(2);

    await page.keyboard.press('Control+Z');
    await page.waitForTimeout(300);
    await expect(page.locator('[data-component="tp-node"]')).toHaveCount(1);

    // Redo (Cmd+Shift+Z).
    await page.keyboard.press('Control+Shift+Z');
    await page.waitForTimeout(300);
    await expect(page.locator('[data-component="tp-node"]')).toHaveCount(2);

    await page.keyboard.press('Control+Shift+Z');
    await page.waitForTimeout(300);
    await expect(page.locator('[data-component="tp-node"]')).toHaveCount(3);
  });
});
