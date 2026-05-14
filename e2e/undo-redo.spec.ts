import { expect, test } from '@playwright/test';

/**
 * Undo / Redo across a multi-edit sequence. Catches the kind of
 * regression where the history stack stops coalescing correctly, or
 * where a redo path produces a stale doc reference.
 *
 * The unit tests cover the store-action shape (`tests/store/document.test.ts`
 * + history slice tests); this e2e gate confirms the keyboard
 * bindings are wired and that React Flow re-renders after each step.
 *
 * Session 82 rewrite: we seed entities via the `window.__TP_TEST__`
 * hook instead of `page.mouse.dblclick()`. The dblclick path was racy
 * on the GitHub-Actions Ubuntu runner — entities sometimes didn't
 * spawn before the exact-count assertions ran. The hook gives us a
 * deterministic seed, so the test now isolates what it actually wants
 * to verify: that Ctrl+Z / Ctrl+Shift+Z mutate the canvas. We also
 * focus the React Flow viewport before pressing the keyboard so the
 * shortcut handler receives the event rather than the document body.
 */

test.describe('undo / redo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?test=1');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.goto('/?test=1');
    await page.waitForFunction(() => Boolean(window.__TP_TEST__));
  });

  test('Cmd+Z undoes the last create; Cmd+Shift+Z redoes', async ({ page }) => {
    // Seed three entities deterministically via the test hook. Each
    // call goes through the regular `addEntity` action so the history
    // slice records each create individually.
    await page.evaluate(() => {
      window.__TP_TEST__!.seed({ titles: ['A', 'B', 'C'] });
    });

    // Wait for the DOM to reflect three nodes — React Flow renders
    // asynchronously after the store mutation.
    await expect(page.locator('[data-component="tp-node"]')).toHaveCount(3);

    // Focus the React Flow viewport so the keyboard shortcut reaches
    // the document-level listener via the canvas (some browsers route
    // keys differently when no element is focused).
    await page.locator('.react-flow__viewport').click({ position: { x: 20, y: 20 } });

    await page.keyboard.press('Control+Z');
    await expect(page.locator('[data-component="tp-node"]')).toHaveCount(2);

    await page.keyboard.press('Control+Z');
    await expect(page.locator('[data-component="tp-node"]')).toHaveCount(1);

    // Redo (Ctrl+Shift+Z).
    await page.keyboard.press('Control+Shift+Z');
    await expect(page.locator('[data-component="tp-node"]')).toHaveCount(2);

    await page.keyboard.press('Control+Shift+Z');
    await expect(page.locator('[data-component="tp-node"]')).toHaveCount(3);
  });
});
