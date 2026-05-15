import { expect, test } from '@playwright/test';

/**
 * Session 95 — Selection-anchored toolbar e2e.
 *
 * Verifies the user-visible contract end-to-end:
 *   1. With nothing selected, the toolbar is not in the DOM.
 *   2. With an entity selected (via the test-hook seed + the store
 *      `selectEntity` action), the toolbar appears above it with the
 *      expected verb buttons (Add child / Add parent / Delete).
 *   3. Clicking a verb dispatches the underlying palette command —
 *      Add child creates a second entity.
 *   4. Opening the palette hides the toolbar; closing reveals it.
 *
 * **Why the test hook instead of dblclick.** Earlier drafts used
 * `page.mouse.dblclick()` to spawn an entity, then expected the
 * toolbar to appear. That path turned out to be racy in CI's
 * headless Chromium: dblclick events sometimes don't register at
 * the canvas's centroid (the same flake affects
 * `visual-canvas.spec.ts:61`). The `window.__TP_TEST__` hook
 * already used by `delete-flow.spec.ts` and `undo-redo.spec.ts`
 * gives deterministic entity seeding + selection without driving
 * React Flow's pointer events.
 */

test.describe('SelectionToolbar e2e', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?test=1');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.goto('/?test=1');
    await page.waitForFunction(() => Boolean(window.__TP_TEST__));
  });

  /**
   * Seed a single entity via the test hook, then click on the
   * rendered React Flow node so RF's onSelectionChange fires and
   * writes the selection back to our zustand store. Programmatic
   * `store.selectEntity()` doesn't survive RF's mount-time
   * onSelectionChange (documented in delete-flow.spec.ts) — clicking
   * the node is the deterministic path.
   */
  const seedAndSelectOne = async (page: import('@playwright/test').Page): Promise<string> => {
    const id = await page.evaluate(() => {
      const created = window.__TP_TEST__!.seed({ titles: ['A'] });
      return created[0]!;
    });
    // Wait for the entity to render so we can click it.
    const node = page.locator(`.react-flow__node[data-id="${id}"]`);
    await node.waitFor({ state: 'visible' });
    await node.click();
    return id;
  };

  test('appears on selection and shows the expected verbs', async ({ page }) => {
    // No selection — toolbar absent.
    await expect(page.locator('[data-component="selection-toolbar"]')).toHaveCount(0);

    await seedAndSelectOne(page);

    const toolbar = page.locator('[data-component="selection-toolbar"]');
    await expect(toolbar).toBeVisible();
    await expect(toolbar.getByRole('button', { name: /^add child$/i })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: /^add parent$/i })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: /^delete$/i })).toBeVisible();
  });

  test('clicking the Add child verb creates a second entity', async ({ page }) => {
    await seedAndSelectOne(page);
    const toolbar = page.locator('[data-component="selection-toolbar"]');
    await expect(toolbar).toBeVisible();

    // Click Add child verb. New entity lands in editing mode; Escape
    // leaves the editor so the count assertion sees the post-editor
    // DOM.
    await toolbar.getByRole('button', { name: /^add child$/i }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-component="tp-node"]')).toHaveCount(2);
  });

  test('hides when the command palette is open', async ({ page }) => {
    await seedAndSelectOne(page);
    await expect(page.locator('[data-component="selection-toolbar"]')).toBeVisible();

    // Open the palette — toolbar should disappear.
    await page.keyboard.press('Control+K');
    await expect(page.getByPlaceholder(/command/i)).toBeVisible();
    await expect(page.locator('[data-component="selection-toolbar"]')).toHaveCount(0);

    // Close the palette — toolbar reappears.
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-component="selection-toolbar"]')).toBeVisible();
  });
});
